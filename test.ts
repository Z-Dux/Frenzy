const USER_MAP = new Map<string, string>();
let uid = 0;

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function encodeBaseN(num: number): string {
    const base = CHARSET.length;
    let result = "";

    do {
        result = CHARSET[num % base] + result;
        num = Math.floor(num / base);
    } while (num > 0);

    return result;
}

function mapUser(userId: string): string {
    // ⚠️ use user.id instead of username (more stable)
    if (!USER_MAP.has(userId)) {
        USER_MAP.set(userId, encodeBaseN(uid++));
    }
    return USER_MAP.get(userId)!;
}

let num = 100;
while (num > 0) {
    console.log(encodeBaseN(num));
    num--;
}