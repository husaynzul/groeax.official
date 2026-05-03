//+------------------------------------------------------------------+
//|                                           TradeLogBridge.mq5    |
//|              Sends MT5 trade events to your TradeLog journal     |
//|                                                                  |
//| SETUP:                                                           |
//|  1. Copy this file to: MetaTrader 5/MQL5/Experts/               |
//|  2. Compile in MetaEditor (F7)                                   |
//|  3. Go to MT5 Options > Expert Advisors > Allow WebRequest for:  |
//|       https://your-app.replit.app                                |
//|  4. Attach the EA to any chart                                   |
//|  5. Set ServerURL and BridgeToken from your TradeLog Brokers page|
//+------------------------------------------------------------------+
#property copyright "TradeLog"
#property version   "1.00"
#property description "Auto-records MT5 trades in your TradeLog journal."
#property strict

//--- Input parameters
input string ServerURL   = "https://your-app.replit.app/api/mt5/trade";
                                          // TradeLog server URL (from Brokers page)
input string BridgeToken = "your-token-here";
                                          // Bridge token (from Brokers page)
input bool   SendOnOpen  = true;          // Record trades when opened
input bool   SendOnClose = true;          // Record trades when closed
input bool   VerboseLog  = false;         // Print detailed logs to Experts tab

//+------------------------------------------------------------------+
int OnInit() {
   Print("[TradeLog] Bridge EA ready. Server: ", ServerURL);
   // Quick connectivity test
   uchar data[], response[];
   string headers = "", respHeaders;
   int code = WebRequest("GET", ServerURL + "/../mt5/status", headers, 5000, data, response, respHeaders);
   if (code == 200) {
      Print("[TradeLog] Server reachable.");
   } else {
      Print("[TradeLog] WARNING: Could not reach server (HTTP ", code, "). Check ServerURL and allowed WebRequest URLs in MT5 Options.");
   }
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result) {
   if (trans.type != TRADE_TRANSACTION_DEAL_ADD) return;

   ulong ticket = trans.deal;
   if (!HistoryDealSelect(ticket)) {
      HistorySelect(TimeCurrent() - 86400, TimeCurrent());
      if (!HistoryDealSelect(ticket)) return;
   }

   ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(ticket, DEAL_ENTRY);

   bool isClose = (entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_INOUT);
   bool isOpen  = (entry == DEAL_ENTRY_IN);

   if (isClose && SendOnClose) SendDeal("trade_close", ticket);
   else if (isOpen && SendOnOpen) SendDeal("trade_open", ticket);
}

//+------------------------------------------------------------------+
void SendDeal(const string eventType, const ulong ticket) {
   string symbol   = HistoryDealGetString(ticket, DEAL_SYMBOL);
   double lots     = HistoryDealGetDouble(ticket, DEAL_VOLUME);
   double price    = HistoryDealGetDouble(ticket, DEAL_PRICE);
   double profit   = HistoryDealGetDouble(ticket, DEAL_PROFIT);
   datetime t      = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
   string comment  = HistoryDealGetString(ticket, DEAL_COMMENT);
   long   dType    = HistoryDealGetInteger(ticket, DEAL_TYPE);

   // Try to get SL/TP from linked position
   double sl = 0, tp = 0;
   ulong  posId = (ulong)HistoryDealGetInteger(ticket, DEAL_POSITION_ID);
   for (int i = OrdersTotal() - 1; i >= 0; i--) {
      ulong oh = OrderGetTicket(i);
      if (OrderGetInteger(ORDER_POSITION_ID) == (long)posId) {
         sl = OrderGetDouble(ORDER_SL);
         tp = OrderGetDouble(ORDER_TP);
         break;
      }
   }

   string direction = (dType == DEAL_TYPE_BUY) ? "BUY" : "SELL";

   MqlDateTime dt;
   TimeToStruct(t, dt);
   string timeStr = StringFormat("%04d-%02d-%02dT%02d:%02d:%02d",
      dt.year, dt.mon, dt.day, dt.hour, dt.min, dt.sec);

   // Escape comment for JSON
   StringReplace(comment, "\"", "'");
   StringReplace(comment, "\\", "/");

   string json = StringFormat(
      "{\"type\":\"%s\",\"ticket\":%I64u,\"symbol\":\"%s\","
      "\"direction\":\"%s\",\"lots\":%.5f,\"price\":%.5f,"
      "\"sl\":%.5f,\"tp\":%.5f,\"profit\":%.2f,"
      "\"time\":\"%s\",\"comment\":\"%s\",\"token\":\"%s\"}",
      eventType, ticket, symbol,
      direction, lots, price,
      sl, tp, profit,
      timeStr, comment, BridgeToken
   );

   if (VerboseLog) Print("[TradeLog] Sending: ", json);

   uchar data[], response[];
   string respHeaders;
   string reqHeaders = "Content-Type: application/json\r\n";
   StringToCharArray(json, data, 0, StringLen(json));

   int code = WebRequest("POST", ServerURL, reqHeaders, 5000, data, response, respHeaders);

   if (code == 200) {
      Print("[TradeLog] OK — ", eventType, " ", symbol, " #", ticket, " (lots:", DoubleToString(lots, 2), " profit:", DoubleToString(profit, 2), ")");
   } else {
      Print("[TradeLog] ERROR sending trade. HTTP code: ", code,
            ". Ensure ServerURL is in MT5 Options > Expert Advisors > Allow WebRequest.");
   }
}

void OnDeinit(const int reason) {
   Print("[TradeLog] Bridge EA removed (reason: ", reason, ")");
}

// Required stubs
void OnTick() {}
void OnTimer() {}
