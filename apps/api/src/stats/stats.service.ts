import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager } from '@mikro-orm/core';
import {
    User,
    GameSession,
    GameTransaction,
    GameOutcome,
    FinanceTransactions,
    PaymentTransactionType,
    PaymentTransactionStatus,
    FinanceProviderSubMethods,
    FinanceProviderMethods
} from '@lib/database';
import { MethodEnum } from '../../../../libs/database/src/entities/finance-provider-methods.entity';

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

export interface GeneralIncomeStats {
    allTimeRUB: number;
    allTimeUSDT: number;
    dailyRUB: number;
    dailyUSDT: number;
}

export interface GeneralWithdrawalStats {
    allTime: number;
    daily: number;
}

export interface PaymentSystemStats {
    depositsAllTime: number;
    depositsDaily: number;
    withdrawalsAllTime: number;
    withdrawalsDaily: number;
}

export interface FinancialStats {
    income: GeneralIncomeStats;
    withdrawals: GeneralWithdrawalStats;
    paymentSystems: {
        cryptoBot: PaymentSystemStats;
        cards: PaymentSystemStats;
        freeKassa: PaymentSystemStats;
        cryptoCloud: PaymentSystemStats;
        usdt: PaymentSystemStats;
        qr: PaymentSystemStats;
    };
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
        @InjectRepository(FinanceTransactions)
        private readonly financeTransactionsRepository: EntityRepository<FinanceTransactions>,
        private readonly em: EntityManager,
    ) { }

    /**
     * Get main platform statistics
     */
    async getMainStats(siteId: number): Promise<MainStats> {
        const [totalPlayers, gamesPlayed, totalBets] = await Promise.all([
            this.userRepository.count({ site: siteId }),
            this.getGamesPlayedCount(siteId),
            this.getTotalBetsAmount(siteId),
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
    private async getGamesPlayedCount(siteId: number): Promise<number> {
        const result = await this.em.getConnection().execute(
            `SELECT COUNT(*) as count 
             FROM "gameSessions" gs
             INNER JOIN "user" u ON gs.user_id = u.id
             WHERE gs.outcome IN (?, ?, ?) 
             AND u.site_id = ?`,
            ['win', 'lost', 'draw', siteId]
        );

        return parseInt(result[0]?.count || '0');
    }

    /**
     * Get total bets amount in RUB
     */
    private async getTotalBetsAmount(siteId: number): Promise<number> {
        const result = await this.em.getConnection().execute(
            `SELECT SUM(gt.amount) as total 
             FROM "gameTransactions" gt
             INNER JOIN "gameSessions" gs ON gt.session_id = gs.id
             INNER JOIN "user" u ON gs.user_id = u.id
             WHERE gt.type = ? 
             AND u.site_id = ?`,
            ['withdraw', siteId]
        );

        return parseFloat(result[0]?.total || '0');
    }

    /**
     * Get leaderboard by wins
     */
    async getLeaderboardByWins(siteId: number): Promise<LeaderboardData> {
        const query = `
      SELECT 
        u.name as username,
        COUNT(CASE WHEN gs.outcome = 'win' THEN 1 END) as wins
      FROM "user" u
      LEFT JOIN "gameSessions" gs ON u.id = gs.user_id
      WHERE u.site_id = ?
      GROUP BY u.id, u.name
      HAVING COUNT(CASE WHEN gs.outcome = 'win' THEN 1 END) > 0
      ORDER BY wins DESC
      LIMIT 10
    `;

        const results = await this.em.getConnection().execute(query, [siteId]);

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
    async getLeaderboardByWinstreak(siteId: number): Promise<LeaderboardData> {
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
                AND u.site_id = ?
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

        const results = await this.em.getConnection().execute(query, [siteId]);

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
    async getLeaderboardByLosingStreak(siteId: number): Promise<LeaderboardData> {
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
                AND u.site_id = ?
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

        const results = await this.em.getConnection().execute(query, [siteId]);

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
    async getLeaderboardByGames(siteId: number): Promise<LeaderboardData> {
        const query = `
      SELECT 
        u.name as username,
        COUNT(CASE WHEN gs.outcome IN ('win', 'lost', 'draw') THEN 1 END) as games_count
      FROM "user" u
      LEFT JOIN "gameSessions" gs ON u.id = gs.user_id
      WHERE u.site_id = ?
      GROUP BY u.id, u.name
      HAVING COUNT(CASE WHEN gs.outcome IN ('win', 'lost', 'draw') THEN 1 END) > 0
      ORDER BY games_count DESC
      LIMIT 10
    `;

        const results = await this.em.getConnection().execute(query, [siteId]);

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
    async getLeaderboardByBets(siteId: number): Promise<LeaderboardData> {
        const query = `
       SELECT 
         u.name as username,
         COALESCE(SUM(gt.amount), 0) as total_bets
       FROM "user" u
       LEFT JOIN "gameSessions" gs ON u.id = gs.user_id
       LEFT JOIN "gameTransactions" gt ON gs.id = gt.session_id AND gt.type = 'withdraw'
       WHERE u.site_id = ?
       GROUP BY u.id, u.name
       ORDER BY total_bets DESC
       LIMIT 10
     `;

        const results = await this.em.getConnection().execute(query, [siteId]);

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

    /**
     * Get comprehensive financial statistics
     */
    async getFinancialStats(siteId: number): Promise<FinancialStats> {
        const [incomeStats, withdrawalStats, paymentSystemStats] = await Promise.all([
            this.getGeneralIncomeStats(siteId),
            this.getGeneralWithdrawalStats(siteId),
            this.getPaymentSystemStats(siteId),
        ]);

        return {
            income: incomeStats,
            withdrawals: withdrawalStats,
            paymentSystems: paymentSystemStats,
        };
    }

    /**
     * Get general income statistics (deposits)
     */
    private async getGeneralIncomeStats(siteId: number): Promise<GeneralIncomeStats> {
        const query = `
            SELECT 
                SUM(CASE WHEN c.name = 'RUB' THEN ft.amount ELSE 0 END) as total_rub,
                SUM(CASE WHEN c.name = 'USD' THEN ft.amount ELSE 0 END) as total_usdt,
                SUM(CASE WHEN c.name = 'RUB' AND ft.created_at >= NOW() - INTERVAL '24 hours' THEN ft.amount ELSE 0 END) as daily_rub,
                SUM(CASE WHEN c.name = 'USD' AND ft.created_at >= NOW() - INTERVAL '24 hours' THEN ft.amount ELSE 0 END) as daily_usdt
            FROM "financeTransactions" ft
            INNER JOIN "financeProviderSubMethods" fsm ON ft.sub_method_id = fsm.id
            INNER JOIN "financeProviderMethods" fm ON fsm.method_id = fm.id
            INNER JOIN "currencies" c ON ft.currency_id = c.id
            WHERE ft.type = 'Payin' 
            AND ft.status = 'Completed'
            AND fsm.site_id = ?
        `;

        const result = await this.em.getConnection().execute(query, [siteId]);
        const row = result[0];

        return {
            allTimeRUB: parseFloat(row?.total_rub || '0'),
            allTimeUSDT: parseFloat(row?.total_usdt || '0'),
            dailyRUB: parseFloat(row?.daily_rub || '0'),
            dailyUSDT: parseFloat(row?.daily_usdt || '0'),
        };
    }

    /**
     * Get general withdrawal statistics
     */
    private async getGeneralWithdrawalStats(siteId: number): Promise<GeneralWithdrawalStats> {
        const query = `
            SELECT 
                SUM(CASE WHEN c.name = 'RUB' THEN ft.amount ELSE 0 END) as total_rub,
                SUM(CASE WHEN c.name = 'RUB' AND ft.created_at >= NOW() - INTERVAL '24 hours' THEN ft.amount ELSE 0 END) as daily_rub
            FROM "financeTransactions" ft
            INNER JOIN "financeProviderSubMethods" fsm ON ft.sub_method_id = fsm.id
            INNER JOIN "financeProviderMethods" fm ON fsm.method_id = fm.id
            INNER JOIN "currencies" c ON ft.currency_id = c.id
            WHERE ft.type = 'Payout' 
            AND ft.status = 'Completed'
            AND fsm.site_id = ?
        `;

        const result = await this.em.getConnection().execute(query, [siteId]);
        const row = result[0];

        return {
            allTime: parseFloat(row?.total_rub || '0'),
            daily: parseFloat(row?.daily_rub || '0'),
        };
    }

    /**
     * Get payment system statistics for all providers
     */
    private async getPaymentSystemStats(siteId: number): Promise<FinancialStats['paymentSystems']> {
        const [cryptoBot, cards, freeKassa, cryptoCloud, usdt, qr] = await Promise.all([
            this.getPaymentSystemStatsByMethod(MethodEnum.CRYPTOBOT, siteId),
            this.getPaymentSystemStatsByMethod(MethodEnum.CARD, siteId),
            this.getPaymentSystemStatsByMethod(MethodEnum.FREEKASSA, siteId),
            this.getPaymentSystemStatsByMethod('cryptocloud', siteId), // Assuming this is the method enum value
            this.getPaymentSystemStatsByMethod(MethodEnum.USDT20, siteId),
            this.getPaymentSystemStatsByMethod('qr', siteId), // Assuming this is the method enum value
        ]);

        return {
            cryptoBot,
            cards,
            freeKassa,
            cryptoCloud,
            usdt,
            qr,
        };
    }

    /**
     * Get payment system statistics for a specific method
     */
    private async getPaymentSystemStatsByMethod(methodValue: string, siteId: number): Promise<PaymentSystemStats> {
        const query = `
            SELECT 
                SUM(CASE WHEN ft.type = 'Payin' THEN ft.amount ELSE 0 END) as deposits_all_time,
                SUM(CASE WHEN ft.type = 'Payin' AND ft.created_at >= NOW() - INTERVAL '24 hours' THEN ft.amount ELSE 0 END) as deposits_daily,
                SUM(CASE WHEN ft.type = 'Payout' THEN ft.amount ELSE 0 END) as withdrawals_all_time,
                SUM(CASE WHEN ft.type = 'Payout' AND ft.created_at >= NOW() - INTERVAL '24 hours' THEN ft.amount ELSE 0 END) as withdrawals_daily
            FROM "financeTransactions" ft
            INNER JOIN "financeProviderSubMethods" fsm ON ft.sub_method_id = fsm.id
            INNER JOIN "financeProviderMethods" fm ON fsm.method_id = fm.id
            INNER JOIN "currencies" c ON ft.currency_id = c.id
            WHERE fm.value = ? 
            AND ft.status = 'Completed'
            AND c.name = 'RUB'
            AND fsm.site_id = ?
        `;

        const result = await this.em.getConnection().execute(query, [methodValue, siteId]);
        const row = result[0];

        return {
            depositsAllTime: parseFloat(row?.deposits_all_time || '0'),
            depositsDaily: parseFloat(row?.deposits_daily || '0'),
            withdrawalsAllTime: parseFloat(row?.withdrawals_all_time || '0'),
            withdrawalsDaily: parseFloat(row?.withdrawals_daily || '0'),
        };
    }
}
