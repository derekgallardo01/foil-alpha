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
exports.sendEmail = sendEmail;
var googleapis_1 = require("googleapis");
var fs = require("fs");
var path = require("path");
var credentialsPath = path.join(process.cwd(), "credentials.json");
console.log("Credentials path:", credentialsPath);
var credentials;
try {
    credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
    console.log("Credentials loaded successfully:", {
        client_id: credentials.web.client_id,
        redirect_uris: credentials.web.redirect_uris,
        project_id: credentials.web.project_id
    });
}
catch (error) {
    console.error("Error loading credentials:", {
        message: error.message,
        stack: error.stack,
    });
    throw new Error("Failed to load Gmail credentials");
}
var _a = credentials.web, client_id = _a.client_id, client_secret = _a.client_secret, redirect_uris = _a.redirect_uris;
var oAuth2Client = new googleapis_1.google.auth.OAuth2(client_id, client_secret, redirect_uris[1]); // Use second redirect URI
var refreshToken = process.env.GMAIL_REFRESH_TOKEN;
if (!refreshToken) {
    console.error("GMAIL_REFRESH_TOKEN is not set in environment variables");
    throw new Error("GMAIL_REFRESH_TOKEN is not set");
}
console.log("Setting credentials with refresh token:", {
    client_id: client_id,
    has_refresh_token: !!refreshToken
});
oAuth2Client.setCredentials({
    refresh_token: refreshToken,
});
oAuth2Client.on("tokens", function (tokens) {
    if (tokens.refresh_token) {
        console.log("New refresh token received:", tokens.refresh_token);
    }
    console.log("Access token refreshed:", tokens.access_token);
});
var gmail = googleapis_1.google.gmail({ version: "v1", auth: oAuth2Client });
function sendEmail(to, subject, htmlContent) {
    return __awaiter(this, void 0, void 0, function () {
        var timestamp, token, emailContent, encodedMessage, response, error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    timestamp = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, , 5]);
                    console.log("[".concat(timestamp, "] Attempting to obtain access token for email to ").concat(to));
                    return [4 /*yield*/, oAuth2Client.getAccessToken()];
                case 2:
                    token = (_b.sent()).token;
                    if (!token) {
                        throw new Error("Failed to obtain access token");
                    }
                    console.log("[".concat(timestamp, "] Access token obtained successfully"));
                    emailContent = [
                        "From: \"TCG Market\" <derekgallardo01@gmail.com>",
                        "To: ".concat(to),
                        "Subject: ".concat(subject),
                        'MIME-Version: 1.0',
                        'Content-Type: multipart/alternative; boundary="boundary"',
                        '',
                        '--boundary',
                        'Content-Type: text/plain; charset="UTF-8"',
                        '',
                        htmlContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' '), // Convert HTML to plain text
                        '',
                        '--boundary',
                        'Content-Type: text/html; charset="UTF-8"',
                        '',
                        htmlContent,
                        '',
                        '--boundary--'
                    ].join('\n');
                    encodedMessage = Buffer.from(emailContent)
                        .toString("base64")
                        .replace(/\+/g, "-")
                        .replace(/\//g, "_")
                        .replace(/=+$/, "");
                    console.log("[".concat(timestamp, "] Sending email to ").concat(to, " with subject: ").concat(subject));
                    return [4 /*yield*/, gmail.users.messages.send({
                            userId: "me",
                            requestBody: { raw: encodedMessage },
                        })];
                case 3:
                    response = _b.sent();
                    console.log("[".concat(timestamp, "] Email sent successfully to ").concat(to), response.data);
                    return [2 /*return*/, response.data];
                case 4:
                    error_1 = _b.sent();
                    console.error("[".concat(timestamp, "] Error sending email to ").concat(to, ":"), {
                        message: error_1.message,
                        stack: error_1.stack,
                        response: (_a = error_1.response) === null || _a === void 0 ? void 0 : _a.data,
                    });
                    throw error_1;
                case 5: return [2 /*return*/];
            }
        });
    });
}
