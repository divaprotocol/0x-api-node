import { LimitOrderFields } from '@0x/protocol-utils';
import { BigNumber } from '@0x/utils';
import { getAddress } from '@ethersproject/address';
import { Contract } from '@ethersproject/contracts';
import { InfuraProvider } from '@ethersproject/providers';
import * as _ from 'lodash';
import { Connection, In, MoreThanOrEqual } from 'typeorm';
import * as WebSocket from 'ws';

import { BalanceCheckerContract, LimitOrder } from '../asset-swapper';
import { fetchPoolLists } from '../asset-swapper/utils/market_operation_utils/pools_cache/pool_list_cache';
import {
    DB_ORDERS_UPDATE_CHUNK_SIZE,
    MAX_ORDER_EXPIRATION_BUFFER_SECONDS,
    SRA_ORDER_EXPIRATION_BUFFER_SECONDS,
    SRA_PERSISTENT_ORDER_POSTING_WHITELISTED_API_KEYS,
    WEBSOCKET_PORT,
} from '../config';
import {
    ARRAY_LIMIT_LENGTH,
    BALANCE_CHECKER_ADDRESS,
    BALANCE_CHECKER_GAS_LIMIT,
    DEFAULT_PAGE,
    DEFAULT_PER_PAGE,
    DIVA_GOVERNANCE_ADDRESS,
    EXCHANGE_PROXY_ADDRESS,
    NULL_ADDRESS,
    NULL_TEXT,
    ONE_SECOND_MS,
} from '../constants';
import { PersistentSignedOrderV4Entity, SignedOrderV4Entity } from '../entities';
import { ExpiredOrderError, ValidationError, ValidationErrorCodes, ValidationErrorReasons } from '../errors';
import { logger } from '../logger';
import {
    IOrderBookService,
    OrderbookResponse,
    OrderEventEndState,
    PaginatedCollection,
    SignedLimitOrder,
    SRAOrder,
} from '../types';
import { orderUtils } from '../utils/order_utils';
import { OrderWatcher, OrderWatcherInterface } from '../utils/order_watcher';
import { paginationUtils } from '../utils/pagination_utils';
import { providerUtils } from '../utils/provider_utils';

export class OrderBookService implements IOrderBookService {
    private readonly _connection: Connection;
    private readonly _orderWatcher: OrderWatcherInterface;

    public static create(connection: Connection | undefined): OrderBookService | undefined {
        if (connection === undefined) {
            return undefined;
        }
        return new OrderBookService(connection, new OrderWatcher());
    }

    constructor(connection: Connection, orderWatcher: OrderWatcherInterface) {
        this._connection = connection;
        this._orderWatcher = orderWatcher;
    }

    public isAllowedPersistentOrders(apiKey: string): boolean {
        return SRA_PERSISTENT_ORDER_POSTING_WHITELISTED_API_KEYS.includes(apiKey);
    }

    // tslint:disable-next-line:prefer-function-over-method
    public async getOrderByHashIfExistsAsync(orderHash: string): Promise<SRAOrder | undefined> {
        let signedOrderEntity;
        signedOrderEntity = await this._connection.manager.findOne(SignedOrderV4Entity, orderHash);
        if (!signedOrderEntity) {
            signedOrderEntity = await this._connection.manager.findOne(PersistentSignedOrderV4Entity, orderHash);
        }
        if (signedOrderEntity === undefined) {
            return undefined;
        } else {
            return orderUtils.deserializeOrderToSRAOrder(signedOrderEntity as Required<SignedOrderV4Entity>);
        }
    }
    public async getOrderBookAsync(
        page: number,
        perPage: number,
        baseToken: string,
        quoteToken: string,
    ): Promise<OrderbookResponse> {
        const orderEntities = await this._connection.manager.find(SignedOrderV4Entity, {
            where: {
                takerToken: In([baseToken, quoteToken]),
                makerToken: In([baseToken, quoteToken]),
            },
        });
        const bidSignedOrderEntities = orderEntities.filter(
            (o) => o.takerToken === baseToken && o.makerToken === quoteToken,
        );
        const askSignedOrderEntities = orderEntities.filter(
            (o) => o.takerToken === quoteToken && o.makerToken === baseToken,
        );
        const bidApiOrders: SRAOrder[] = (bidSignedOrderEntities as Required<SignedOrderV4Entity>[])
            .map(orderUtils.deserializeOrderToSRAOrder)
            .filter(orderUtils.isFreshOrder)
            .sort((orderA, orderB) => orderUtils.compareBidOrder(orderA.order, orderB.order));
        const askApiOrders: SRAOrder[] = (askSignedOrderEntities as Required<SignedOrderV4Entity>[])
            .map(orderUtils.deserializeOrderToSRAOrder)
            .filter(orderUtils.isFreshOrder)
            .sort((orderA, orderB) => orderUtils.compareAskOrder(orderA.order, orderB.order));
        const paginatedBidApiOrders = paginationUtils.paginate(bidApiOrders, page, perPage);
        const paginatedAskApiOrders = paginationUtils.paginate(askApiOrders, page, perPage);
        return {
            bids: paginatedBidApiOrders,
            asks: paginatedAskApiOrders,
        };
    }

    public async getOrdersAsync(
        page: number,
        perPage: number,
        orderFieldFilters: Partial<SignedOrderV4Entity>,
        additionalFilters: { isUnfillable?: boolean; trader?: string },
    ): Promise<PaginatedCollection<SRAOrder>> {
        // Validation
        if (additionalFilters.isUnfillable === true && orderFieldFilters.maker === undefined) {
            throw new ValidationError([
                {
                    field: 'maker',
                    code: ValidationErrorCodes.RequiredField,
                    reason: ValidationErrorReasons.UnfillableRequiresMakerAddress,
                },
            ]);
        }

        // Each array element in `filters` is an OR subclause
        const filters = [];

        // Pre-filters; exists in the entity verbatim
        const columnNames = this._connection.getMetadata(SignedOrderV4Entity).columns.map((x) => x.propertyName);
        const orderFilter = _.pickBy(orderFieldFilters, (v, k) => {
            return columnNames.includes(k);
        });

        // Post-filters; filters that don't exist verbatim
        if (additionalFilters.trader) {
            filters.push({
                ...orderFilter,
                maker: additionalFilters.trader,
            });

            filters.push({
                ...orderFilter,
                taker: additionalFilters.trader,
            });
        } else {
            filters.push(orderFilter);
        }

        // Add an expiry time check to all filters
        const minExpiryTime = Math.floor(Date.now() / ONE_SECOND_MS) + SRA_ORDER_EXPIRATION_BUFFER_SECONDS;
        const filtersWithExpirationCheck = filters.map((filter) => ({
            ...filter,
            expiry: MoreThanOrEqual(minExpiryTime),
        }));

        const [signedOrderCount, signedOrderEntities] = await Promise.all([
            this._connection.manager.count(SignedOrderV4Entity, {
                where: filtersWithExpirationCheck,
            }),
            this._connection.manager.find(SignedOrderV4Entity, {
                where: filtersWithExpirationCheck,
                ...paginationUtils.paginateDBFilters(page, perPage),
                order: {
                    hash: 'ASC',
                },
            }),
        ]);
        const apiOrders = (signedOrderEntities as Required<SignedOrderV4Entity>[]).map(
            orderUtils.deserializeOrderToSRAOrder,
        );

        // Join with persistent orders
        let persistentOrders: SRAOrder[] = [];
        let persistentOrdersCount = 0;
        if (additionalFilters.isUnfillable === true) {
            const removedStates = [
                OrderEventEndState.Cancelled,
                OrderEventEndState.Expired,
                OrderEventEndState.FullyFilled,
                OrderEventEndState.Invalid,
                OrderEventEndState.StoppedWatching,
                OrderEventEndState.Unfunded,
            ];
            const filtersWithoutDuplicateSignedOrders = filters.map((filter) => ({
                ...filter,
                orderState: In(removedStates),
            }));
            let persistentOrderEntities = [];
            [persistentOrdersCount, persistentOrderEntities] = await Promise.all([
                this._connection.manager.count(PersistentSignedOrderV4Entity, {
                    where: filtersWithoutDuplicateSignedOrders,
                }),
                this._connection.manager.find(PersistentSignedOrderV4Entity, {
                    where: filtersWithoutDuplicateSignedOrders,
                    ...paginationUtils.paginateDBFilters(page, perPage),
                    order: {
                        hash: 'ASC',
                    },
                }),
            ]);
            persistentOrders = (persistentOrderEntities as Required<PersistentSignedOrderV4Entity>[]).map(
                orderUtils.deserializeOrderToSRAOrder,
            );
        }

        const allOrders = apiOrders.concat(persistentOrders);
        const total = signedOrderCount + persistentOrdersCount;

        // Paginate
        const paginatedApiOrders = paginationUtils.paginateSerialize(allOrders, total, page, perPage);
        return paginatedApiOrders;
    }

    // tslint:disable-next-line:prefer-function-over-method
    public async getBatchOrdersAsync(
        page: number,
        perPage: number,
        makerTokens: string[],
        takerTokens: string[],
    ): Promise<PaginatedCollection<SRAOrder>> {
        const filterObject = {
            makerToken: In(makerTokens),
            takerToken: In(takerTokens),
        };
        const signedOrderEntities = (await this._connection.manager.find(SignedOrderV4Entity, {
            where: filterObject,
        })) as Required<SignedOrderV4Entity>[];
        const apiOrders = signedOrderEntities.map(orderUtils.deserializeOrderToSRAOrder);

        // check for expired orders
        const { fresh, expired } = orderUtils.groupByFreshness(apiOrders, SRA_ORDER_EXPIRATION_BUFFER_SECONDS);
        logErrorOnExpiredOrders(expired);

        const paginatedApiOrders = paginationUtils.paginate(fresh, page, perPage);
        return paginatedApiOrders;
    }
    public async addOrderAsync(signedOrder: SignedLimitOrder): Promise<void> {
        await this._orderWatcher.postOrdersAsync([signedOrder]);
        // After creating this order, we get the updated bid and ask information for the pool.
        const result: any[] = [];
        result.push({
            poolId: signedOrder.poolId,
            first: await this.getOrderBookAsync(
                DEFAULT_PAGE,
                DEFAULT_PER_PAGE,
                signedOrder.makerToken,
                signedOrder.takerToken,
            ),
            second: await this.getOrderBookAsync(
                DEFAULT_PAGE,
                DEFAULT_PER_PAGE,
                signedOrder.takerToken,
                signedOrder.makerToken,
            ),
        });

        // Send the data using websocket to every clients
        wss.clients.forEach((client) => {
            client.send(JSON.stringify(result));
        });
    }

    // tslint:disable-next-line:prefer-function-over-method
    public async addOrdersAsync(signedOrders: SignedLimitOrder[]): Promise<void> {
        await this._orderWatcher.postOrdersAsync(signedOrders);
        // After creating these orders, we get the updated bid and ask information for the pool.
        const result: any[] = [];
        await Promise.all(
            signedOrders.map(async (signedOrder) => {
                const isExists = result.filter((item) => item[0] === signedOrder.poolId);

                if (isExists.length === 0) {
                    result.push({
                        poolId: signedOrder.poolId,
                        first: await this.getOrderBookAsync(
                            DEFAULT_PAGE,
                            DEFAULT_PER_PAGE,
                            signedOrder.makerToken,
                            signedOrder.takerToken,
                        ),
                        second: await this.getOrderBookAsync(
                            DEFAULT_PAGE,
                            DEFAULT_PER_PAGE,
                            signedOrder.takerToken,
                            signedOrder.makerToken,
                        ),
                    });
                }
            }),
        );

        // Send the data using websocket to every clients
        wss.clients.forEach((client) => {
            client.send(JSON.stringify(result));
        });
    }

    // tslint:disable-next-line:prefer-function-over-method
    public async addPersistentOrdersAsync(signedOrders: SignedLimitOrder[]): Promise<void> {
        await this._orderWatcher.postOrdersAsync(signedOrders);
        // After creating these orders, we get the updated bid and ask information for the pool.
        const result: any[] = [];
        await Promise.all(
            signedOrders.map(async (signedOrder) => {
                const isExists = result.filter((item) => item[0] === signedOrder.poolId);

                if (isExists.length === 0) {
                    result.push({
                        poolId: signedOrder.poolId,
                        first: await this.getOrderBookAsync(
                            DEFAULT_PAGE,
                            DEFAULT_PER_PAGE,
                            signedOrder.makerToken,
                            signedOrder.takerToken,
                        ),
                        second: await this.getOrderBookAsync(
                            DEFAULT_PAGE,
                            DEFAULT_PER_PAGE,
                            signedOrder.takerToken,
                            signedOrder.makerToken,
                        ),
                    });
                }
            }),
        );

        // Send the data using websocket to every clients
        wss.clients.forEach((client) => {
            client.send(JSON.stringify(result));
        });

        // Figure out which orders were accepted by looking for them in the database.
        const hashes = signedOrders.map((o) => {
            const limitOrder = new LimitOrder(o as LimitOrderFields);
            return limitOrder.getHash();
        });
        const addedOrders = await this._connection.manager.find(SignedOrderV4Entity, {
            where: { hash: In(hashes) },
        });
        // MAX SQL variable size is 999. This limit is imposed via Sqlite.
        // The SELECT query is not entirely effecient and pulls in all attributes
        // so we need to leave space for the attributes on the model represented
        // as SQL variables in the "AS" syntax. We leave 99 free for the
        // signedOrders model
        await this._connection
            .getRepository(PersistentSignedOrderV4Entity)
            .save(addedOrders, { chunk: DB_ORDERS_UPDATE_CHUNK_SIZE });
    }

    // tslint:disable-next-line:prefer-function-over-method
    public async offerCreateContingentPoolsAsync(req: OfferCreateContingentPoolFilterType): Promise<any> {
        const offerCreateContingentPoolEntities = await this._connection.manager.find(OfferCreateContingentPoolEntity);
        const apiEntities: OfferCreateContingentPool[] = (
            offerCreateContingentPoolEntities as Required<OfferCreateContingentPoolEntity[]>
        ).map(orderUtils.deserializeOfferCreateContingentPool);

        const filterEntities: OfferCreateContingentPool[] = apiEntities.filter(
            (apiEntity: OfferCreateContingentPool) => {
                if (req.maker !== NULL_ADDRESS && apiEntity.maker.toLocaleLowerCase() !== req.maker) {
                    return false;
                }
                if (req.taker !== NULL_ADDRESS && apiEntity.taker.toLocaleLowerCase() !== req.taker) {
                    return false;
                }
                if (req.makerDirection !== NULL_TEXT && req.makerDirection !== apiEntity.makerDirection) {
                    return false;
                }
                if (req.referenceAsset !== NULL_TEXT && apiEntity.referenceAsset !== req.referenceAsset) {
                    return false;
                }
                if (
                    req.collateralToken !== NULL_ADDRESS &&
                    apiEntity.collateralToken.toLocaleLowerCase() !== req.collateralToken
                ) {
                    return false;
                }
                if (
                    req.dataProvider !== NULL_ADDRESS &&
                    apiEntity.dataProvider.toLocaleLowerCase() !== req.dataProvider
                ) {
                    return false;
                }
                if (
                    req.permissionedERC721Token !== NULL_ADDRESS &&
                    apiEntity.permissionedERC721Token.toLocaleLowerCase() !== req.permissionedERC721Token
                ) {
                    return false;
                }

                return true;
            },
        );

        return paginationUtils.paginate(filterEntities, req.page, req.perPage);
    }

    // tslint:disable-next-line:prefer-function-over-method
    public async getOfferCreateContingentPoolByOfferHashAsync(offerHash: string): Promise<any> {
        const offerCreateContingentPoolEntity = await this._connection.manager.findOne(
            OfferCreateContingentPoolEntity,
            offerHash,
        );

        return orderUtils.deserializeOfferCreateContingentPool(
            offerCreateContingentPoolEntity as Required<OfferCreateContingentPoolEntity>,
        );
    }

    // tslint:disable-next-line:prefer-function-over-method
    public async postOfferCreateContingentPoolAsync(
        offerCreateContingentPoolEntity: OfferCreateContingentPoolEntity,
    ): Promise<any> {
        await this._connection.getRepository(OfferCreateContingentPoolEntity).insert(offerCreateContingentPoolEntity);

        return offerCreateContingentPoolEntity.offerHash;
    }

    // tslint:disable-next-line:prefer-function-over-method
    public async offerAddLiquidityAsync(req: OfferAddLiquidityFilterType): Promise<any> {
        const offerAddLiquidityEntities = await this._connection.manager.find(OfferAddLiquidityEntity);
        const apiEntities: OfferAddLiquidity[] = (offerAddLiquidityEntities as Required<OfferAddLiquidityEntity[]>).map(
            orderUtils.deserializeOfferAddLiquidity,
        );

        const filterEntities: OfferAddLiquidity[] = apiEntities.filter((apiEntity: OfferAddLiquidity) => {
            if (req.maker !== NULL_ADDRESS && apiEntity.maker.toLocaleLowerCase() !== req.maker) {
                return false;
            }
            if (req.taker !== NULL_ADDRESS && apiEntity.taker.toLocaleLowerCase() !== req.taker) {
                return false;
            }
            if (req.makerDirection !== NULL_TEXT && req.makerDirection !== apiEntity.makerDirection) {
                return false;
            }
            if (req.poolId !== NULL_TEXT && apiEntity.poolId !== req.poolId) {
                return false;
            }
            if (req.referenceAsset !== NULL_TEXT && apiEntity.referenceAsset !== req.referenceAsset) {
                return false;
            }
            if (req.collateralToken !== NULL_ADDRESS && apiEntity.collateralToken !== req.collateralToken) {
                return false;
            }
            if (req.dataProvider !== NULL_ADDRESS && apiEntity.dataProvider !== req.dataProvider) {
                return false;
            }

            return true;
        });

        return paginationUtils.paginate(filterEntities, req.page, req.perPage);
    }

    // tslint:disable-next-line:prefer-function-over-method
    public async getOfferAddLiquidityByOfferHashAsync(offerHash: string): Promise<any> {
        const offerAddLiquidityEntity = await this._connection.manager.findOne(OfferAddLiquidityEntity, offerHash);

        return orderUtils.deserializeOfferAddLiquidity(offerAddLiquidityEntity as Required<OfferAddLiquidityEntity>);
    }

    // tslint:disable-next-line:prefer-function-over-method
    public async postOfferAddLiquidityAsync(offerAddLiquidityEntity: OfferAddLiquidityEntity): Promise<any> {
        // Get provider to call web3 function
        const provider = new InfuraProvider(offerAddLiquidityEntity.chainId, INFURA_API_KEY);
        // Get DIVA contract to call web3 function
        const divaContract = new Contract(
            offerAddLiquidityEntity.verifyingContract || NULL_ADDRESS,
            divaContractABI,
            provider,
        );
        // Get parameters of pool using pool id
        const parameters = await divaContract.functions.getPoolParameters(offerAddLiquidityEntity.poolId);
        const referenceAsset = parameters[0].referenceAsset;
        const collateralToken = parameters[0].collateralToken;
        const dataProvider = parameters[0].dataProvider;

        const fillableOfferAddLiquidityEntity: OfferAddLiquidityEntity = {
            ...offerAddLiquidityEntity,
            referenceAsset,
            collateralToken,
            dataProvider,
        };
        await this._connection.getRepository(OfferAddLiquidityEntity).insert(fillableOfferAddLiquidityEntity);

        return offerAddLiquidityEntity.offerHash;
    }
}

/**
 * If the max age of expired orders exceeds the configured threshold, this function
 * logs an error capturing the details of the expired orders
 */
function logErrorOnExpiredOrders(expired: SRAOrder[], details?: string): void {
    const maxExpirationTimeSeconds = Date.now() / ONE_SECOND_MS + MAX_ORDER_EXPIRATION_BUFFER_SECONDS;
    let idx = 0;
    if (
        expired.find((order, i) => {
            idx = i;
            return order.order.expiry.toNumber() > maxExpirationTimeSeconds;
        })
    ) {
        const error = new ExpiredOrderError(expired[idx].order, MAX_ORDER_EXPIRATION_BUFFER_SECONDS, details);
        logger.error(error);
    }
}
