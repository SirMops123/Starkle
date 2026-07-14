export type ScoreResult = { valid: true; points: number } | { valid: false; reason: string };

export function scoreGroup(dice: number[]): ScoreResult {
    const sorted = [...dice].sort((a, b) => a - b);
    const n = sorted.length;

    if (n === 1) {
        if (sorted[0] === 1) return { valid: true, points: 100 };
        if (sorted[0] === 5) return { valid: true, points: 50 };
        return { valid: false, reason: 'single dice must be 1 or 5' };
    }

    if (n === 5 && sorted.join('') === '12345') return { valid: true, points: 500 };
    if (n === 5 && sorted.join('') === '23456') return { valid: true, points: 750 };
    if (n === 6 && sorted.join('') === '123456') return { valid: true, points: 1500 };

    if (n >= 3 && n <= 6 && sorted.every(v => v === sorted[0])) {
        const face = sorted[0];
        const base = face === 1 ? 1000 : face * 100;
        const extraCount = n - 3; // jede weitere Zahl verdoppelt
        return { valid: true, points: base * Math.pow(2, extraCount) };
    }

    return { valid: false, reason: 'not a valid combination' };
}

export function calculatePoolScore(groups: number[][]): number {
    return groups.reduce((sum, group) => {
        const result = scoreGroup(group);
        return sum + (result.valid ? result.points : 0);
    }, 0);
}

export function hasAnyScoringOption(dice: number[]): boolean {
    if (dice.some(d => d === 1 || d === 5)) return true;

    const counts = countValues(dice);
    if (Object.values(counts).some(c => c >= 3)) return true;

    const sorted = [...dice].sort((a, b) => a - b).join('');
    if (dice.length >= 5 && (sorted.includes('12345') || sorted.includes('23456'))) return true;
    if (dice.length === 6 && sorted === '123456') return true;

    return false;
}

export function countValues(dice: number[]): Record<number, number> {
    const counts: Record<number, number> = {};
    for (const d of dice) counts[d] = (counts[d] || 0) + 1;
    return counts;
}