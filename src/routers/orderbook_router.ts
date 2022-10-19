import * as express from 'express';
import * as asyncHandler from 'express-async-handler';

import { SRAHandlers } from '../handlers/sra_handlers';
import { IOrderBookService } from '../types';

export function createOrderBookRouter(orderBook: IOrderBookService): express.Router {
    const router = express.Router();
    const handlers = new SRAHandlers(orderBook);
    /**
     * GET Orderbook endpoint retrieves the orderbook for a given asset pair.
     */
    router.get('/', asyncHandler(handlers.orderbookAsync.bind(handlers)));
    /**
     * GET Price endpoint retrieves the prices by order hash.
     */
    router.get('/prices', asyncHandler(handlers.orderbookPricesAsync.bind(handlers)));
    /**
     * GET Orders endpoint retrieves a list of orders given query parameters.
     */
    router.get('/orders', asyncHandler(handlers.ordersAsync.bind(handlers)));
    /**
     * GET FeeRecepients endpoint retrieves a collection of all fee recipient addresses for a relayer.
     */
    router.get('/fee_recipients', SRAHandlers.feeRecipients.bind(SRAHandlers));
    /**
     * POST Order config endpoint retrives the values for order fields that the relayer requires.
     */
    router.post('/order_config', SRAHandlers.orderConfig.bind(SRAHandlers));
    /**
     * POST Order endpoint submits an order to the Relayer.
     */
    router.post('/order', asyncHandler(handlers.postOrderAsync.bind(handlers)));
    /**
     * POST Orders endpoint submits several orders to the Relayer.
     * This is an additional endpoint not a part of the official SRA standard
     */
    router.post('/orders', asyncHandler(handlers.postOrdersAsync.bind(handlers)));
    /**
     * POST Persistent order endpoint submits an order that will be persisted even after cancellation or expiration.
     * Requires an API Key
     */
    router.post('/order/persistent', asyncHandler(handlers.postPersistentOrderAsync.bind(handlers)));
    /**
     * GET Order endpoint retrieves the order by order hash.
     */
    router.get('/order/:orderHash', asyncHandler(handlers.getOrderByHashAsync.bind(handlers)));
    /**
     * GET Offer endpoint retrieves the offer by offer hash.
     */
    router.get('/offer/:offerHash', asyncHandler(handlers.getOfferByOfferHashAsync.bind(handlers)));
    /**
     * GET Offers endpoint retrieves a list of offers given query parameters.
     */
    router.get('/offers', asyncHandler(handlers.offersAsync.bind(handlers)));
    /**
     * POST Offer endpoint submits an offer to the Relayer.
     */
    router.post('/offer', asyncHandler(handlers.postOfferAsync.bind(handlers)));
    return router;
}
