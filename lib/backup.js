import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import config from '../config.js';
import { printLog } from './print.js';

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
let backupRunning = false;

function getBackupDirectory() {
    const configured = config.backupDirectory || 'backups';
    return path.isAbsolute(configured) ? configured : path.join(projectRoot, configured);
}

function stamp(date = new Date()) {
    return date.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
}

function zipExclusions(backupDirectory) {
    const relativeBackupDirectory = path.relative(projectRoot, backupDirectory).replace(/\\/g, '/');
    const exclusions = [
        'node_modules/*',
        '.git/*',
        'temp/*',
        'tmp/*',
        'logs/*',
        'coverage/*',
        '.env',
        '.env.*',
        '*.log'
    ];
    if (relativeBackupDirectory && !relativeBackupDirectory.startsWith('../')) {
        exclusions.push(`${relativeBackupDirectory.replace(/\/$/, '')}/*`);
    }
    return exclusions.flatMap((entry) => ['-x', entry]);
}

function listBackups() {
    const directory = getBackupDirectory();
    if (!fs.existsSync(directory))
        return [];
    return fs.readdirSync(directory)
        .filter((file) => file.endsWith('.zip'))
        .map((file) => {
            const fullPath = path.join(directory, file);
            const stat = fs.statSync(fullPath);
            return { file, path: fullPath, size: stat.size, mtime: stat.mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);
}

async function pruneBackups() {
    const retention = Math.max(1, Number(config.backupRetention) || 7);
    const backups = listBackups();
    for (const backup of backups.slice(retention)) {
        try {
            fs.unlinkSync(backup.path);
        }
        catch (error) {
            printLog('warning', `Could not remove old backup ${backup.file}: ${error.message}`);
        }
    }
}

export async function createBackup() {
    if (backupRunning)
        return null;
    backupRunning = true;
    const directory = getBackupDirectory();
    const filename = `mega-md-${stamp()}.zip`;
    const output = path.join(directory, filename);
    const partial = `${output}.partial`;
    try {
        fs.mkdirSync(directory, { recursive: true });
        await execFileAsync('zip', [
            '-r',
            '-q',
            partial,
            '.',
            ...zipExclusions(directory)
        ], { cwd: projectRoot, maxBuffer: 1024 * 1024 * 4 });
        fs.renameSync(partial, output);
        await pruneBackups();
        const sizeMb = (fs.statSync(output).size / 1024 / 1024).toFixed(2);
        printLog('success', `Backup created: ${filename} (${sizeMb} MB)`);
        return { file: filename, path: output, size: Number(sizeMb) };
    }
    catch (error) {
        try {
            if (fs.existsSync(partial))
                fs.unlinkSync(partial);
        }
        catch { }
        printLog('error', `Backup failed: ${error.message}`);
        return null;
    }
    finally {
        backupRunning = false;
    }
}

export function startBackupScheduler() {
    if (!config.backupEnabled)
        return null;
    const interval = Math.max(60_000, Number(config.backupInterval) || 24 * 60 * 60 * 1000);
    const initialDelay = Math.min(60_000, interval);
    const initialTimer = setTimeout(() => createBackup(), initialDelay);
    initialTimer.unref?.();
    const timer = setInterval(() => createBackup(), interval);
    timer.unref?.();
    printLog('info', `Automatic backups enabled: every ${Math.round(interval / 3_600_000 * 10) / 10}h, keeping ${config.backupRetention} files`);
    return timer;
}

export { listBackups };
