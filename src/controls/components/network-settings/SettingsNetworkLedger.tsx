import React, { useCallback, useSyncExternalStore } from "react";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  clearOutboundRequestLog,
  getOutboundRequestLog,
  subscribeOutboundRequestLog,
} from "@/lib/litechat/outbound-policy";

const emptySnapshot: ReturnType<typeof getOutboundRequestLog> = [];

const formatTime = (timestamp: string): string => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return timestamp;
  }
};

const SettingsNetworkLedgerComponent: React.FC = () => {
  const records = useSyncExternalStore(
    subscribeOutboundRequestLog,
    getOutboundRequestLog,
    () => emptySnapshot,
  );

  const handleClear = useCallback(() => {
    clearOutboundRequestLog();
  }, []);

  return (
    <div className="p-1 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-medium">Network Ledger</h3>
          <p className="text-sm text-muted-foreground">
            Recent outbound destinations recorded during this app session.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={records.length === 0}
        >
          <Trash2Icon className="mr-2 h-4 w-4" />
          Clear
        </Button>
      </div>

      <div className="rounded-md border overflow-hidden">
        {records.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            No outbound requests recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Time</th>
                  <th className="px-3 py-2 text-left font-medium">Host</th>
                  <th className="px-3 py-2 text-left font-medium">Purpose</th>
                  <th className="px-3 py-2 text-left font-medium">URL</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record, index) => (
                  <tr key={`${record.timestamp}-${record.url}-${index}`} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {formatTime(record.timestamp)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium">
                      {record.host}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {record.purpose}
                    </td>
                    <td className="px-3 py-2 min-w-[20rem] max-w-[36rem] truncate font-mono text-xs text-muted-foreground">
                      {record.url}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export const SettingsNetworkLedger = React.memo(SettingsNetworkLedgerComponent);
