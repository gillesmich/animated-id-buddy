import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Bug, AlertCircle, Info, Terminal, Trash2, Minimize2, Maximize2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LogEntry {
  id: number;
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
  timestamp: string;
}

const MobileDebugOverlay = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const logIdRef = useRef(0);

  // Capturer les logs console
  useEffect(() => {
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info
    };

    const addLog = (type: LogEntry['type'], ...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');

      setLogs(prev => {
        const newLogs = [...prev, {
          id: logIdRef.current++,
          type,
          message,
          timestamp: new Date().toLocaleTimeString()
        }];
        // Garder seulement les 100 derniers logs
        return newLogs.slice(-100);
      });
    };

    console.log = (...args) => {
      originalConsole.log(...args);
      addLog('log', ...args);
    };

    console.error = (...args) => {
      originalConsole.error(...args);
      addLog('error', ...args);
    };

    console.warn = (...args) => {
      originalConsole.warn(...args);
      addLog('warn', ...args);
    };

    console.info = (...args) => {
      originalConsole.info(...args);
      addLog('info', ...args);
    };

    // Capturer les erreurs globales
    const handleError = (event: ErrorEvent) => {
      addLog('error', `${event.message} at ${event.filename}:${event.lineno}`);
    };

    window.addEventListener('error', handleError);

    return () => {
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      console.info = originalConsole.info;
      window.removeEventListener('error', handleError);
    };
  }, []);

  // Gestion du drag
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isMinimized) return;
    setIsDragging(true);
    setDragStart({
      x: e.touches[0].clientX - position.x,
      y: e.touches[0].clientY - position.y
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || isMinimized) return;
    setPosition({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="w-3 h-3 text-red-500" />;
      case 'warn':
        return <AlertCircle className="w-3 h-3 text-yellow-500" />;
      case 'info':
        return <Info className="w-3 h-3 text-blue-500" />;
      default:
        return <Terminal className="w-3 h-3 text-muted-foreground" />;
    }
  };

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'error':
        return 'text-red-500 bg-red-500/10 border-red-500/30';
      case 'warn':
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      case 'info':
        return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
      default:
        return 'text-muted-foreground bg-secondary/30 border-border/30';
    }
  };

  const clearLogs = () => {
    setLogs([]);
    console.log("🧹 Debug logs cleared");
  };

  if (!isVisible) {
    return (
      <Button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-[9999] rounded-full w-14 h-14 gradient-primary shadow-lg"
        size="icon"
      >
        <Bug className="w-6 h-6" />
      </Button>
    );
  }

  if (isMinimized) {
    return (
      <Card 
        className="fixed bottom-4 right-4 z-[9999] p-3 glass border-primary/30 shadow-lg"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`
        }}
      >
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold">Debug ({logs.length})</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsMinimized(false)}
          >
            <Maximize2 className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsVisible(false)}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card 
      className="fixed bottom-4 right-4 z-[9999] w-[90vw] max-w-md h-[60vh] flex flex-col glass border-primary/30 shadow-elegant"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        touchAction: 'none'
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/50 bg-primary/5">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold">Debug Console</h3>
          <span className="text-xs text-muted-foreground">({logs.length})</span>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={clearLogs}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsMinimized(true)}
          >
            <Minimize2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsVisible(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* System Info */}
      <div className="p-2 bg-secondary/30 border-b border-border/30 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">User Agent:</span>
          <span className="font-mono text-[10px] truncate max-w-[60%]">{navigator.userAgent.split(' ')[0]}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Screen:</span>
          <span className="font-mono">{window.innerWidth}x{window.innerHeight}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Online:</span>
          <span className={navigator.onLine ? "text-green-500" : "text-red-500"}>
            {navigator.onLine ? "✓ Connected" : "✗ Offline"}
          </span>
        </div>
      </div>

      {/* Logs */}
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Terminal className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-xs">No logs yet</p>
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className={`p-2 rounded text-xs border ${getLogColor(log.type)}`}
              >
                <div className="flex items-start gap-2">
                  {getLogIcon(log.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold uppercase text-[10px]">{log.type}</span>
                      <span className="text-[10px] opacity-70">{log.timestamp}</span>
                    </div>
                    <pre className="text-[11px] whitespace-pre-wrap break-words font-mono">
                      {log.message}
                    </pre>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer Stats */}
      <div className="flex justify-around p-2 border-t border-border/30 bg-secondary/20 text-xs">
        <div className="flex items-center gap-1">
          <Terminal className="w-3 h-3" />
          <span>{logs.filter(l => l.type === 'log').length}</span>
        </div>
        <div className="flex items-center gap-1 text-blue-500">
          <Info className="w-3 h-3" />
          <span>{logs.filter(l => l.type === 'info').length}</span>
        </div>
        <div className="flex items-center gap-1 text-yellow-500">
          <AlertCircle className="w-3 h-3" />
          <span>{logs.filter(l => l.type === 'warn').length}</span>
        </div>
        <div className="flex items-center gap-1 text-red-500">
          <AlertCircle className="w-3 h-3" />
          <span>{logs.filter(l => l.type === 'error').length}</span>
        </div>
      </div>
    </Card>
  );
};

export default MobileDebugOverlay;
