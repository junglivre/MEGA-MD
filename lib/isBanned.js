import { isBannedIdentity } from './bannedUsers.js';
async function isBanned(userId) {
    try {
        return await isBannedIdentity(userId);
    }
    catch (error) {
        console.error('Error checking banned status:', error);
        return false;
    }
}
export { isBanned };
