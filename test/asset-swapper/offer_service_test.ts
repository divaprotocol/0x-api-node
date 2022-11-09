import { Connection } from 'typeorm';
import { OfferLiquidityType } from '../../src/config';
import { NULL_ADDRESS, NULL_TEXT } from '../../src/constants';
import { getDBConnectionAsync } from '../../src/db_connection';
import {
    OfferAddLiquidityEntity,
    OfferCreateContingentPoolEntity,
    OfferRemoveLiquidityEntity,
} from '../../src/entities';
import { OfferService } from '../../src/services/offer_service';
import { OfferCreateContingentPoolFilterType, OfferLiquidityFilterType } from '../../src/types';

const SUITE_NAME = 'OfferService';

async function deleteCreateContingentPoolAsync(connection: Connection, offerHash: string): Promise<void> {
    try {
        await connection.manager.delete(OfferCreateContingentPoolEntity, offerHash);
    } catch (e) {
        return;
    }
}

async function deleteOfferAddLiquidityAsync(connection: Connection, offerHash: string): Promise<void> {
    try {
        await connection.manager.delete(OfferAddLiquidityEntity, offerHash);
    } catch (e) {
        return;
    }
}

async function deleteOfferRemoveLiquidityAsync(connection: Connection, offerHash: string): Promise<void> {
    try {
        await connection.manager.delete(OfferRemoveLiquidityEntity, offerHash);
    } catch (e) {
        return;
    }
}

describe(SUITE_NAME, () => {
    let connection: Connection;
    let offerService: OfferService;

    before(async () => {
        connection = await getDBConnectionAsync();
        offerService = new OfferService(connection);
    });

    describe(`CreateContingentPool Test`, () => {
        let description = `Get all CreateContingentPool's list.`;
        it(description, async () => {
            const req: OfferCreateContingentPoolFilterType = {
                page: 1,
                perPage: 1000,
                maker: NULL_ADDRESS,
                taker: NULL_ADDRESS,
                makerDirection: NULL_TEXT,
                referenceAsset: NULL_TEXT,
                collateralToken: NULL_ADDRESS,
                dataProvider: NULL_ADDRESS,
                permissionedERC721Token: NULL_ADDRESS,
            };

            await offerService.offerCreateContingentPoolsAsync(req);
        });

        description = 'Create a new CreateContingentPool.';
        it(description, async () => {
            const offerCreateContingentPoolEntity: OfferCreateContingentPoolEntity = {
                maker: '0x9AdEFeb576dcF52F5220709c1B267d89d5208D78',
                taker: '0x0000000000000000000000000000000000000000',
                makerCollateralAmount: '0',
                takerCollateralAmount: '10000000000000000000',
                makerDirection: 'true',
                offerExpiry: '1667054387',
                minimumTakerFillAmount: '10000000000000000000',
                referenceAsset: 'BTC/USD',
                expiryTime: '1667057920',
                floor: '200000000000000000000',
                inflection: '200000000000000000000',
                cap: '200000000000000000000',
                gradient: '1000000000000000000',
                collateralToken: '0xFA158C9B780A4213f3201Ae74Cca013712c8538d',
                dataProvider: '0x245b8abbc1b70b370d1b81398de0a7920b25e7ca',
                capacity: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
                permissionedERC721Token: '0x0000000000000000000000000000000000000000',
                salt: '1666449598081',
                signature: JSON.stringify({
                    v: 28,
                    r: '0x15cc0c72de1c4100e4c771777ce04c89204766ba4f478e4c1db2a84c88f755cd',
                    s: '0x3c219c920a14a0b895e0843e5b4b373670b291c7a0fdea892eecf436a79d1bb8',
                }),
                offerHash: '0x37109f7b2b702ae5b0a6de0cf2acc54b04272429f21ee4362501dcbec0b711db',
                chainId: 5,
                verifyingContract: '0x6cDEc9b70431bf650f3A0DDD0e246368a4C4F1E1',
            };

            await offerService.postOfferCreateContingentPoolAsync(offerCreateContingentPoolEntity);
        });

        description = 'Get the CreateContingentPool by offerHash.';
        it(description, async () => {
            const offerHash = '0x37109f7b2b702ae5b0a6de0cf2acc54b04272429f21ee4362501dcbec0b711db';

            await offerService.getOfferCreateContingentPoolByOfferHashAsync(offerHash);

            await deleteCreateContingentPoolAsync(connection, offerHash);
        });
    });

    describe(`OfferAddLiquidity Test`, () => {
        let description = `Get all OfferAddLiquidity's list.`;
        it(description, async () => {
            const req: OfferLiquidityFilterType = {
                page: 1,
                perPage: 1000,
                maker: NULL_ADDRESS,
                taker: NULL_ADDRESS,
                makerDirection: NULL_TEXT,
                referenceAsset: NULL_TEXT,
                collateralToken: NULL_ADDRESS,
                dataProvider: NULL_ADDRESS,
                permissionedERC721Token: NULL_ADDRESS,
                poolId: NULL_TEXT,
            };

            await offerService.offerAddLiquidityAsync(req);
        });

        description = 'Create a new OfferAddLiquidity.';
        it(description, async () => {
            const offerAddLiquidityEntity: OfferAddLiquidityEntity = {
                maker: '0x9AdEFeb576dcF52F5220709c1B267d89d5208D78',
                taker: '0x0000000000000000000000000000000000000000',
                makerCollateralAmount: '3000000000000000000',
                takerCollateralAmount: '7000000000000000000',
                makerDirection: 'true',
                offerExpiry: '1665587500',
                minimumTakerFillAmount: '1000000000000000000',
                poolId: '24',
                salt: '1665501187956',
                signature: JSON.stringify({
                    v: 27,
                    r: '0xc811bda094814115b4d7938a3ff4c933ed00cd89fbecace297af34c02090bcd4',
                    s: '0x43e5f9222a9a96b84af9d923af59d0faa0c1a06c6b6d6a39c0b260635aeeed06',
                }),
                offerHash: '0xa8a5ce8d58d60d736b2929d846f35e952504fe82ed82fe78bbb347809b43e5f9',
                actualTakerFillableAmount: '7000000000000000000',
                chainId: 5,
                verifyingContract: '0x6cDEc9b70431bf650f3A0DDD0e246368a4C4F1E1',
            };

            await offerService.postOfferLiquidityAsync(offerAddLiquidityEntity, OfferLiquidityType.Add);
        });

        description = 'Get the OfferAddLiquidity by offerHash.';
        it(description, async () => {
            const offerHash = '0xa8a5ce8d58d60d736b2929d846f35e952504fe82ed82fe78bbb347809b43e5f9';

            await offerService.getOfferAddLiquidityByOfferHashAsync(offerHash);

            await deleteOfferAddLiquidityAsync(connection, offerHash);
        });
    });

    describe(`OfferRemoveLiquidity Test`, () => {
        let description = `Get all OfferRemoveLiquidity's list.`;
        it(description, async () => {
            const req: OfferLiquidityFilterType = {
                page: 1,
                perPage: 1000,
                maker: NULL_ADDRESS,
                taker: NULL_ADDRESS,
                makerDirection: NULL_TEXT,
                referenceAsset: NULL_TEXT,
                collateralToken: NULL_ADDRESS,
                dataProvider: NULL_ADDRESS,
                permissionedERC721Token: NULL_ADDRESS,
                poolId: NULL_TEXT,
            };

            await offerService.offerAddLiquidityAsync(req);
        });

        description = 'Create a new OfferRemoveLiquidity.';
        it(description, async () => {
            const offerRemoveLiquidityEntity: OfferRemoveLiquidityEntity = {
                offerHash: '0xa8a5ce8d58d60d736b2929d846f35e952504fe82ed82fe78bbb347809b43e5f9',
                maker: '0x9AdEFeb576dcF52F5220709c1B267d89d5208D78',
                taker: '0x0000000000000000000000000000000000000000',
                positionTokenAmount: '100000000000000000000',
                makerCollateralAmount: '80000000000000000000',
                makerDirection: 'true',
                offerExpiry: '1666907188',
                minimumTakerFillAmount: '10000000000000000000',
                salt: '1666907016401',
                poolId: '123',
                actualTakerFillableAmount: '100000000000000000000',
                chainId: 5,
                verifyingContract: '0x6cDEc9b70431bf650f3A0DDD0e246368a4C4F1E1',
                referenceAsset: 'BTC/USD',
                collateralToken: '0xFA158C9B780A4213f3201Ae74Cca013712c8538d',
                dataProvider: '0x625abcb0c7371d6691796e972089d75ed356523b',
                permissionedERC721Token: '0x0000000000000000000000000000000000000000',
                signature: JSON.stringify({
                    v: 28,
                    r: '0x2c724ae4ed950ecb046d68d1b5cabf51070ed4d3ece9c4eba75ef577817e6808',
                    s: '0x7c2e3dfe2c6c6cab11ecbc0b7e9e6569dea96b02c1fa06af84566f136e4702d9',
                }),
            };

            await offerService.postOfferLiquidityAsync(offerRemoveLiquidityEntity, OfferLiquidityType.Remove);
        });

        description = 'Get the OfferRemoveLiquidity by offerHash.';
        it(description, async () => {
            const offerHash = '0xa8a5ce8d58d60d736b2929d846f35e952504fe82ed82fe78bbb347809b43e5f9';

            await offerService.getOfferRemoveLiquidityByOfferHashAsync(offerHash);

            await deleteOfferRemoveLiquidityAsync(connection, offerHash);
        });
    });
});
