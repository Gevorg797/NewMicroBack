import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager } from '@mikro-orm/core';
import { User, GameSession, GameTransaction, GameOutcome } from '@lib/database';

export interface MainStats {
    totalPlayers: number;
    gamesPlayed: number;
    totalBets: number;
}

export interface LeaderboardEntry {
    rank: number;
    username: string;
    value: number;
    medal: string;
}

export interface LeaderboardData {
    title: string;
    entries: LeaderboardEntry[];
    footer: string;
}

export interface UserStats {
    userId: number;
    username: string;
    gamesPlayed: number;
    gamesWon: number;
    winrate: number;
    winstreak: number;
    losingStreak: number;
    totalBet: number;
    actualBet: number;
    balance: number;
}

@Injectable()
export class StatsService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: EntityRepository<User>,
        @InjectRepository(GameSession)
        private readonly gameSessionRepository: EntityRepository<GameSession>,
        @InjectRepository(GameTransaction)
        private readonly gameTransactionRepository: EntityRepository<GameTransaction>,
        private readonly em: EntityManager,
    ) { }

    /**
     * Get main platform statistics
     */
    async getMainStats(): Promise<MainStats> {
        const [totalPlayers, gamesPlayed, totalBets] = await Promise.all([
            this.userRepository.count(),
            this.getGamesPlayedCount(),
            this.getTotalBetsAmount(),
        ]);

        return {
            totalPlayers,
            gamesPlayed,
            totalBets,
        };
    }

    /**
     * Get count of games played (only with valid outcomes)
     */
    private async getGamesPlayedCount(): Promise<number> {
        const result = await this.em.getConnection().execute(
            'SELECT COUNT(*) as count FROM "gameSessions" WHERE outcome IN (?, ?, ?)',
            ['win', 'lost', 'draw']
        );

        return parseInt(result[0]?.count || '0');
    }

    /**
     * Get total bets amount in RUB
     */
    private async getTotalBetsAmount(): Promise<number> {
        const result = await this.em.getConnection().execute(
            'SELECT SUM(amount) as total FROM "gameTransactions" WHERE type = ?',
            ['withdraw']
        );

        return parseFloat(result[0]?.total || '0');
    }

    /**
     * Get leaderboard by wins
     */
    async getLeaderboardByWins(): Promise<LeaderboardData> {
        const query = `
      SELECT 
        u.name as username,
        COUNT(CASE WHEN gs.outcome = 'win' THEN 1 END) as wins
      FROM "user" u
      LEFT JOIN "gameSessions" gs ON u.id = gs.user_id
      GROUP BY u.id, u.name
      HAVING COUNT(CASE WHEN gs.outcome = 'win' THEN 1 END) > 0
      ORDER BY wins DESC
      LIMIT 10
    `;

        const results = await this.em.getConnection().execute(query);

        const entries: LeaderboardEntry[] = results.map((row: any, index: number) => ({
            rank: index + 1,
            username: row.username || `Юзер №${index + 1}`,
            value: parseInt(row.wins),
            medal: this.getMedalForRank(index + 1),
        }));

        // Add fallback entries if no results
        if (entries.length === 0) {
            for (let i = 1; i <= 10; i++) {
                entries.push({
                    rank: i,
                    username: `Юзер №${i}`,
                    value: 0,
                    medal: this.getMedalForRank(i),
                });
            }
        }

        return {
            title: 'Топ пользователей (по победам):',
            entries,
            footer: 'Отсортировано по количеству побед!',
        };
    }

    /**
     * Get leaderboard by winstreak
     */
    async getLeaderboardByWinstreak(): Promise<LeaderboardData> {
        const query = `
            WITH user_games AS (
                SELECT 
                    u.id,
                    u.name,
                    gs.outcome,
                    gs.created_at,
                    ROW_NUMBER() OVER (PARTITION BY u.id ORDER BY gs.created_at) - 
                    ROW_NUMBER() OVER (PARTITION BY u.id, gs.outcome ORDER BY gs.created_at) as streak_group
                FROM "user" u
                INNER JOIN "gameSessions" gs ON u.id = gs.user_id
                WHERE gs.outcome IN ('win', 'lost')
            ),
            win_streaks AS (
                SELECT 
                    id,
                    name,
                    COUNT(*) as streak_length
                FROM user_games
                WHERE outcome = 'win'
                GROUP BY id, name, streak_group
            )
            SELECT 
                name as username,
                MAX(streak_length) as winstreak
            FROM win_streaks
            GROUP BY id, name
            HAVING MAX(streak_length) > 0
            ORDER BY winstreak DESC
            LIMIT 10
        `;

        const results = await this.em.getConnection().execute(query);

        const entries: LeaderboardEntry[] = results.map((row: any, index: number) => ({
            rank: index + 1,
            username: row.username || `Юзер №${index + 1}`,
            value: parseInt(row.winstreak),
            medal: this.getMedalForRank(index + 1),
        }));

        // Add fallback entries if no results
        if (entries.length === 0) {
            for (let i = 1; i <= 10; i++) {
                entries.push({
                    rank: i,
                    username: `Player ${i}`,
                    value: 0,
                    medal: this.getMedalForRank(i),
                });
            }
        }

        return {
            title: 'Топ пользователей (по винстрику):',
            entries,
            footer: 'Отсортировано по максимальному винстрику!',
        };
    }

    /**
     * Get leaderboard by losing streak
     */
    async getLeaderboardByLosingStreak(): Promise<LeaderboardData> {
        const query = `
            WITH user_games AS (
                SELECT 
                    u.id,
                    u.name,
                    gs.outcome,
                    gs.created_at,
                    ROW_NUMBER() OVER (PARTITION BY u.id ORDER BY gs.created_at) - 
                    ROW_NUMBER() OVER (PARTITION BY u.id, gs.outcome ORDER BY gs.created_at) as streak_group
                FROM "user" u
                INNER JOIN "gameSessions" gs ON u.id = gs.user_id
                WHERE gs.outcome IN ('win', 'lost')
            ),
            losing_streaks AS (
                SELECT 
                    id,
                    name,
                    COUNT(*) as streak_length
                FROM user_games
                WHERE outcome = 'lost'
                GROUP BY id, name, streak_group
            )
            SELECT 
                name as username,
                MAX(streak_length) as losing_streak
            FROM losing_streaks
            GROUP BY id, name
            HAVING MAX(streak_length) > 0
            ORDER BY losing_streak DESC
            LIMIT 10
        `;

        const results = await this.em.getConnection().execute(query);

        const entries: LeaderboardEntry[] = results.map((row: any, index: number) => ({
            rank: index + 1,
            username: row.username || `Юзер №${index + 1}`,
            value: parseInt(row.losing_streak),
            medal: this.getMedalForRank(index + 1),
        }));

        // Add fallback entries if no results
        if (entries.length === 0) {
            for (let i = 1; i <= 10; i++) {
                entries.push({
                    rank: i,
                    username: `Player ${i}`,
                    value: 0,
                    medal: this.getMedalForRank(i),
                });
            }
        }

        return {
            title: 'Топ пользователей (по лузстрику):',
            entries,
            footer: 'Отсортировано по максимальному лузстрику!',
        };
    }

    /**
     * Get leaderboard by number of games
     */
    async getLeaderboardByGames(): Promise<LeaderboardData> {
        const query = `
      SELECT 
        u.name as username,
        COUNT(CASE WHEN gs.outcome IN ('win', 'lost', 'draw') THEN 1 END) as games_count
      FROM "user" u
      LEFT JOIN "gameSessions" gs ON u.id = gs.user_id
      GROUP BY u.id, u.name
      HAVING COUNT(CASE WHEN gs.outcome IN ('win', 'lost', 'draw') THEN 1 END) > 0
      ORDER BY games_count DESC
      LIMIT 10
    `;

        const results = await this.em.getConnection().execute(query);

        const entries: LeaderboardEntry[] = results.map((row: any, index: number) => ({
            rank: index + 1,
            username: row.username || `Юзер №${index + 1}`,
            value: parseInt(row.games_count),
            medal: this.getMedalForRank(index + 1),
        }));

        // Add fallback entries if no results
        if (entries.length === 0) {
            for (let i = 1; i <= 10; i++) {
                entries.push({
                    rank: i,
                    username: `Player ${i}`,
                    value: 0,
                    medal: this.getMedalForRank(i),
                });
            }
        }

        return {
            title: 'Топ пользователей (по кол-ву игр):',
            entries,
            footer: 'Отсортировано по количеству игр!',
        };
    }

    /**
     * Get leaderboard by total bets amount
     */
    async getLeaderboardByBets(): Promise<LeaderboardData> {
        const query = `
       SELECT 
         u.name as username,
         COALESCE(SUM(gt.amount), 0) as total_bets
       FROM "user" u
       LEFT JOIN "gameSessions" gs ON u.id = gs.user_id
       LEFT JOIN "gameTransactions" gt ON gs.id = gt.session_id AND gt.type = 'withdraw'
       GROUP BY u.id, u.name
       ORDER BY total_bets DESC
       LIMIT 10
     `;

        const results = await this.em.getConnection().execute(query);

        const entries: LeaderboardEntry[] = results.map((row: any, index: number) => ({
            rank: index + 1,
            username: row.username || `Юзер №${index + 1}`,
            value: parseFloat(row.total_bets),
            medal: this.getMedalForRank(index + 1),
        }));

        // Add fallback entries if no results
        if (entries.length === 0) {
            for (let i = 1; i <= 10; i++) {
                entries.push({
                    rank: i,
                    username: `Юзер №${i}`,
                    value: 0,
                    medal: this.getMedalForRank(i),
                });
            }
        }

        return {
            title: 'Топ пользователей (по сумме ставок):',
            entries,
            footer: 'Отсортировано по общей сумме ставок!',
        };
    }

    /**
     * Get user statistics
     */
    async getUserStats(userId: number): Promise<UserStats> {
        // Get user info
        const userQuery = `
            SELECT id, name, telegram_id
            FROM "user"
            WHERE id = ?
        `;
        const userResult = await this.em.getConnection().execute(userQuery, [userId]);
        const user = userResult[0];

        if (!user) {
            throw new Error('User not found');
        }

        // Get games played and won count
        const gamesQuery = `
            SELECT 
                COUNT(CASE WHEN outcome IN ('win', 'lost', 'draw') THEN 1 END) as games_played,
                COUNT(CASE WHEN outcome = 'win' THEN 1 END) as games_won
            FROM "gameSessions"
            WHERE user_id = ?
        `;
        const gamesResult = await this.em.getConnection().execute(gamesQuery, [userId]);
        const gamesPlayed = parseInt(gamesResult[0]?.games_played) || 0;
        const gamesWon = parseInt(gamesResult[0]?.games_won) || 0;
        const winrate = gamesPlayed > 0 ? (gamesWon / gamesPlayed) * 100 : 0;

        // Get bet amounts
        const betsQuery = `
            SELECT 
                COALESCE(SUM(CASE WHEN gt.type = 'bet' THEN gt.amount ELSE 0 END), 0) as total_bet,
                COALESCE(SUM(CASE WHEN gt.type = 'withdraw' THEN gt.amount ELSE 0 END), 0) as actual_bet
            FROM "gameTransactions" gt
            INNER JOIN "gameSessions" gs ON gt.session_id = gs.id
            WHERE gs.user_id = ?
        `;
        const betsResult = await this.em.getConnection().execute(betsQuery, [userId]);

        // Get main balance only (not bonus)
        const balanceQuery = `
            SELECT COALESCE(balance, 0) as balance
            FROM "balances"
            WHERE user_id = ? AND type = 'main'
        `;
        const balanceResult = await this.em.getConnection().execute(balanceQuery, [userId]);

        // Get maximum winstreak and losing streak for this user
        const streakQuery = `
            WITH user_games AS (
                SELECT 
                    outcome,
                    created_at,
                    ROW_NUMBER() OVER (ORDER BY created_at) - 
                    ROW_NUMBER() OVER (PARTITION BY outcome ORDER BY created_at) as streak_group
                FROM "gameSessions"
                WHERE user_id = ? AND outcome IN ('win', 'lost')
            ),
            streaks AS (
                SELECT 
                    outcome,
                    COUNT(*) as streak_length
                FROM user_games
                GROUP BY outcome, streak_group
            )
            SELECT 
                outcome,
                MAX(streak_length) as max_streak
            FROM streaks
            GROUP BY outcome
        `;

        const streakResult = await this.em.getConnection().execute(streakQuery, [userId]);

        let winstreak = 0;
        let losingStreak = 0;

        for (const row of streakResult) {
            if (row.outcome === 'win') {
                winstreak = parseInt(row.max_streak) || 0;
            } else if (row.outcome === 'lost') {
                losingStreak = parseInt(row.max_streak) || 0;
            }
        }

        return {
            userId: parseInt(user.id),
            username: user.name || `User ${user.telegram_id}`,
            gamesPlayed,
            gamesWon,
            winrate: Math.round(winrate * 100) / 100,
            winstreak,
            losingStreak,
            totalBet: parseFloat(betsResult[0]?.total_bet) || 0,
            actualBet: parseFloat(betsResult[0]?.actual_bet) || 0,
            balance: parseFloat(balanceResult[0]?.balance) || 0,
        };
    }

    /**
     * Get medal emoji for rank
     */
    private getMedalForRank(rank: number): string {
        switch (rank) {
            case 1:
                return '🥇';
            case 2:
                return '🥈';
            case 3:
                return '🥉';
            default:
                return '🎖';
        }
    }
}
