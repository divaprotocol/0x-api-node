import { BigNumber } from '@0x/utils';

export const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
export const NULL_BYTES = '0x';
export const ZRX_DECIMALS = 18;
export const DEFAULT_PAGE = 1;
export const DEFAULT_PER_PAGE = 1000;
export const ZERO = new BigNumber(0);
export const ONE = new BigNumber(1);
export const MAX_TOKEN_SUPPLY_POSSIBLE = new BigNumber(2).pow(256);
export const DEFAULT_LOCAL_POSTGRES_URI = 'postgres://postgres:postgres@localhost/diva-api';
export const DEFAULT_LOGGER_INCLUDE_TIMESTAMP = true;
export const ONE_SECOND_MS = 1000;
export const ONE_MINUTE_MS = ONE_SECOND_MS * 60;
export const ONE_HOUR_MS = ONE_MINUTE_MS * 60;
export const TEN_MINUTES_MS = ONE_MINUTE_MS * 10;
export const DEFAULT_VALIDATION_GAS_LIMIT = 10e6;
export const HEX_BASE = 16;
export const PROTOCOL_FEE = 0;

// Swap Quoter
export const QUOTE_ORDER_EXPIRATION_BUFFER_MS = ONE_SECOND_MS * 60; // Ignore orders that expire in 60 seconds
const GAS_LIMIT_BUFFER_PERCENTAGE = 0.1; // Add 10% to the estimated gas limit
export const GAS_LIMIT_BUFFER_MULTIPLIER = GAS_LIMIT_BUFFER_PERCENTAGE + 1;
export const DEFAULT_QUOTE_SLIPPAGE_PERCENTAGE = 0.01; // 1% Slippage
export const DEFAULT_FALLBACK_SLIPPAGE_PERCENTAGE = 0.015; // 1.5% Slippage in a fallback route
export const ETH_SYMBOL = 'ETH';
export const WETH_SYMBOL = 'WETH';
export const ADDRESS_HEX_LENGTH = 42;
export const DEFAULT_TOKEN_DECIMALS = 18;
export const FIRST_PAGE = 1;
export const PERCENTAGE_SIG_DIGITS = 4;
export const PROTOCOL_FEE_UTILS_POLLING_INTERVAL_IN_MS = 6000;
export const TX_BASE_GAS = new BigNumber(21000);
export const AFFILIATE_FEE_TRANSFORMER_GAS = new BigNumber(15000);
export const POSITIVE_SLIPPAGE_FEE_TRANSFORMER_GAS = new BigNumber(30000);
export const ONE_GWEI = new BigNumber(1000000000);
export const AFFILIATE_DATA_SELECTOR = '869584cd';

// RFQM Service
export const KEEP_ALIVE_TTL = ONE_MINUTE_MS * 5;
export const RFQM_TRANSACTION_WATCHER_SLEEP_TIME_MS = ONE_SECOND_MS * 15;
export const RFQM_NUM_BUCKETS = 1000;

// API namespaces
export const SRA_PATH = '/sra/v4';
export const SWAP_PATH = '/swap/v1';
export const META_TRANSACTION_PATH = '/meta_transaction/v1';
export const METRICS_PATH = '/metrics';
export const RFQM_PATH = '/rfqm/v1';
export const ORDERBOOK_PATH = '/orderbook/v1';
export const API_KEY_HEADER = '0x-api-key';
export const HEALTHCHECK_PATH = '/healthz';

// Docs
export const SWAP_DOCS_URL = 'https://0x.org/docs/api#swap';
export const SRA_DOCS_URL = 'https://0x.org/docs/api#sra';
export const META_TRANSACTION_DOCS_URL = 'https://0x.org/docs/api#meta_transaction';

export const DEFAULT_ZERO_EX_GAS_API_URL = 'https://gas.api.0x.org/source/median';

export const ETH_DECIMALS = 18;
export const GWEI_DECIMALS = 9;

// Logging
export const NUMBER_SOURCES_PER_LOG_LINE = 12;

// RFQ Quote Validator expiration threshold
export const RFQ_FIRM_QUOTE_CACHE_EXPIRY = ONE_MINUTE_MS * 2;
export const RFQ_ALLOWANCE_TARGET = '0xdef1c0ded9bec7f1a1670819833240f027b25eff';
export const RFQM_MINIMUM_EXPIRY_DURATION_MS = ONE_MINUTE_MS;
export const RFQM_TX_GAS_ESTIMATE = 165e3;
export const RFQ_DYNAMIC_BLACKLIST_TTL = ONE_SECOND_MS * 30;

// SQS Client
export const LONG_POLLING_WAIT_TIME_SECONDS = 20;
export const SINGLE_MESSAGE = 1;

// General cache control
export const DEFAULT_CACHE_AGE_SECONDS = 13;

// Number of base points in 1
export const ONE_IN_BASE_POINTS = 10000;

// Whether Slippage Protect is enabled by default
export const DEFAULT_ENABLE_SLIPPAGE_PROTECTION = true;

// Exchange Proxy Address
export const EXCHANGE_PROXY_ADDRESS = '0xf91bb752490473b8342a3e964e855b9f9a2a668e';

// Balance Checker Address
export const BALANCE_CHECKER_ADDRESS = '0x6F9b7892a6272880905E90DC5AcD1F56dF222FbE';
export const BALANCE_CHECKER_GAS_LIMIT = 10000000;

// Diva Governance Address
export const DIVA_GOVERNANCE_ADDRESS =
  '0xBb0F479895915F80f6fEb5BABcb0Ad39a0D7eF4E'; // creator of pools on Main Markets page and trading fee recipient

// Trading Fee
export const TRADING_FEE = 0.01; // 1%

// The limit of array length that can send by parameter of smart contract function
export const ARRAY_LIMIT_LENGTH = 400;
