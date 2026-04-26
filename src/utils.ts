export function dateToRelative(date: Date): string {
    // returns as x mins ago, x hours ago, x days ago, etc. or in x mins, x hours, x days, etc. if in the future
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const absDiff = Math.abs(diff);
    const seconds = Math.floor(absDiff / 1000);
    const minutes = Math.floor(absDiff / (1000 * 60));
    const hours = Math.floor(absDiff / (1000 * 60 * 60));
    const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(absDiff / (1000 * 60 * 60 * 24 * 7));
    const months = Math.floor(absDiff / (1000 * 60 * 60 * 24 * 30));
    const years = Math.floor(absDiff / (1000 * 60 * 60 * 24 * 365));

    return `${diff < 0 ? "in " : ""}${years > 0 ? years + " year" + (years > 1 ? "s" : "") : seconds > 0 ? seconds + " second" + (seconds > 1 ? "s" : "") : minutes > 0 ? minutes + " minute" + (minutes > 1 ? "s" : "") : hours > 0 ? hours + " hour" + (hours > 1 ? "s" : "") : days > 0 ? days + " day" + (days > 1 ? "s" : "") : weeks > 0 ? weeks + " week" + (weeks > 1 ? "s" : "") : months > 0 ? months + " month" + (months > 1 ? "s" : "") : "just now"}${diff >= 0 ? " ago" : ""}`;
}