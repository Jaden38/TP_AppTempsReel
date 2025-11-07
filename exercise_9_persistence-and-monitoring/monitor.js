export class Monitor {
    constructor() {
        this.stats = {
            connections: 0,
            activeConnections: 0,
            totalSyncs: 0,
            syncTypes: { add: 0, update: 0, delete: 0 },
            latencies: [],
            startTime: Date.now()
        };
        
        this.logs = [];
        this.maxLogs = 100;
    }
    
    recordConnection() {
        this.stats.connections++;
        this.stats.activeConnections++;
        this.addLog('connection', { timestamp: Date.now() });
    }
    
    recordDisconnection() {
        this.stats.activeConnections--;
        this.addLog('disconnection', { timestamp: Date.now() });
    }
    
    recordSync(type) {
        this.stats.totalSyncs++;
        this.stats.syncTypes[type]++;
        this.addLog('sync', { type, timestamp: Date.now() });
    }
    
    recordLatency(ms) {
        this.stats.latencies.push(ms);
        if (this.stats.latencies.length > 1000) {
            this.stats.latencies = this.stats.latencies.slice(-1000);
        }
    }
    
    addLog(type, data) {
        this.logs.push({ type, ...data });
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
    }
    
    getStats() {
        const latencies = this.stats.latencies;
        const avgLatency = latencies.length > 0 
            ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
            : 0;
        
        const p95Latency = latencies.length > 0
            ? latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)]
            : 0;
        
        return {
            ...this.stats,
            avgLatency: Math.round(avgLatency),
            p95Latency: Math.round(p95Latency),
            uptime: Date.now() - this.stats.startTime,
            recentLogs: this.logs.slice(-10)
        };
    }
}