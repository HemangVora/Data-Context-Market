"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@clickhouse/client");
var client = (0, client_1.createClient)({
    url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
    username: process.env.CLICKHOUSE_USER || "default",
    password: process.env.CLICKHOUSE_PASSWORD || "password",
});
function checkEvents() {
    return __awaiter(this, void 0, void 0, function () {
        var countResult, countData, result, events, txHash, txResult, txEvents;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log("Checking events in ClickHouse...\n");
                    return [4 /*yield*/, client.query({
                            query: "SELECT COUNT(*) as count FROM bahack_events",
                            format: "JSONEachRow",
                        })];
                case 1:
                    countResult = _b.sent();
                    return [4 /*yield*/, countResult.json()];
                case 2:
                    countData = _b.sent();
                    console.log("Total events:", ((_a = countData[0]) === null || _a === void 0 ? void 0 : _a.count) || 0);
                    return [4 /*yield*/, client.query({
                            query: "\n      SELECT \n        block_number,\n        timestamp,\n        text_id,\n        description,\n        price_usdc,\n        pay_address,\n        tx_hash\n      FROM bahack_events \n      ORDER BY block_number DESC\n      LIMIT 10\n    ",
                            format: "JSONEachRow",
                        })];
                case 3:
                    result = _b.sent();
                    return [4 /*yield*/, result.json()];
                case 4:
                    events = _b.sent();
                    console.log("\nLatest events:");
                    console.log(JSON.stringify(events, null, 2));
                    txHash = "0x597a7b566dab7d334b3c8b70f64c75225edcce3dfa16547c144c2ccffd2cf4fc";
                    return [4 /*yield*/, client.query({
                            query: "\n      SELECT * FROM bahack_events \n      WHERE tx_hash = '".concat(txHash, "'\n    "),
                            format: "JSONEachRow",
                        })];
                case 5:
                    txResult = _b.sent();
                    return [4 /*yield*/, txResult.json()];
                case 6:
                    txEvents = _b.sent();
                    console.log("\nLooking for transaction ".concat(txHash, ":"));
                    console.log(txEvents.length > 0 ? JSON.stringify(txEvents, null, 2) : "NOT FOUND");
                    return [4 /*yield*/, client.close()];
                case 7:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
checkEvents().catch(console.error);
