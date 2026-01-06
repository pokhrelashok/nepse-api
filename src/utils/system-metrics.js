const os = require('os');
const { execSync } = require('child_process');

/**
 * Get system resource metrics
 */
async function getSystemMetrics() {
  const metrics = {
    timestamp: new Date().toISOString(),
    uptime: {},
    cpu: {},
    memory: {},
    disk: {},
    process: {}
  };

  // System uptime
  const uptimeSeconds = os.uptime();
  metrics.uptime = {
    seconds: uptimeSeconds,
    formatted: formatUptime(uptimeSeconds)
  };

  // CPU Info
  const cpus = os.cpus();
  const cpuCount = cpus.length;
  const cpuModel = cpus[0]?.model || 'Unknown';

  // Calculate CPU usage (average across all cores)
  const cpuUsage = getCpuUsage();
  metrics.cpu = {
    model: cpuModel,
    cores: cpuCount,
    usage: cpuUsage,
    loadAverage: os.loadavg() // 1, 5, 15 minute load averages
  };

  // Memory Info
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  metrics.memory = {
    total: totalMem,
    used: usedMem,
    free: freeMem,
    usagePercent: Math.round((usedMem / totalMem) * 100 * 10) / 10,
    formatted: {
      total: formatBytes(totalMem),
      used: formatBytes(usedMem),
      free: formatBytes(freeMem)
    }
  };

  // Disk Info (try to get disk usage)
  try {
    const diskInfo = getDiskUsage();
    metrics.disk = diskInfo;
  } catch (e) {
    metrics.disk = { error: 'Unable to get disk info' };
  }

  // Process Info
  const processMemory = process.memoryUsage();
  metrics.process = {
    pid: process.pid,
    uptime: process.uptime(),
    uptimeFormatted: formatUptime(process.uptime()),
    memory: {
      heapUsed: processMemory.heapUsed,
      heapTotal: processMemory.heapTotal,
      rss: processMemory.rss,
      external: processMemory.external,
      formatted: {
        heapUsed: formatBytes(processMemory.heapUsed),
        heapTotal: formatBytes(processMemory.heapTotal),
        rss: formatBytes(processMemory.rss)
      }
    },
    nodeVersion: process.version
  };

  return metrics;
}

/**
 * Get CPU usage percentage
 */
function getCpuUsage() {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }

  const idle = totalIdle / cpus.length;
  const total = totalTick / cpus.length;
  const usage = 100 - Math.round((idle / total) * 100 * 10) / 10;

  return usage;
}

/**
 * Get disk usage (works on Linux/Mac)
 */
function getDiskUsage() {
  try {
    // Use df command to get disk usage
    const output = execSync('df -h / 2>/dev/null || df -h 2>/dev/null | head -2', { encoding: 'utf8' });
    const lines = output.trim().split('\n');

    if (lines.length >= 2) {
      const parts = lines[1].split(/\s+/);
      // df output: Filesystem Size Used Avail Use% Mounted
      return {
        filesystem: parts[0],
        total: parts[1],
        used: parts[2],
        available: parts[3],
        usagePercent: parseInt(parts[4]) || 0,
        mountPoint: parts[5] || '/'
      };
    }
  } catch (e) {
    // Fallback for Windows or if df fails
    return { error: 'Unable to get disk info' };
  }

  return { error: 'Unable to parse disk info' };
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format seconds to human readable uptime
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

module.exports = {
  getSystemMetrics,
  formatBytes,
  formatUptime
};
