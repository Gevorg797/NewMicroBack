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
            this.gameSessionRepository.count(),
            this.getTotalBetsAmount(),
        ]);

        return {
            totalPlayers,
            gamesPlayed,
            totalBets,
        };
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
      WITH user_winstreaks AS (
        SELECT 
          u.id,
          u.name,
          gs.outcome,
          ROW_NUMBER() OVER (PARTITION BY u.id ORDER BY gs.created_at DESC) as rn,
          ROW_NUMBER() OVER (PARTITION BY u.id, gs.outcome ORDER BY gs.created_at DESC) as outcome_rn
        FROM "user" u
        LEFT JOIN "gameSessions" gs ON u.id = gs.user_id
        WHERE gs.outcome IS NOT NULL
      ),
      current_streaks AS (
        SELECT 
          id,
          name,
          outcome,
          ROW_NUMBER() OVER (PARTITION BY id ORDER BY rn) as streak_length
        FROM user_winstreaks
        WHERE rn = outcome_rn AND outcome = 'win'
      )
      SELECT 
        name as username,
        MAX(streak_length) as winstreak
      FROM current_streaks
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

        return {
            title: 'Топ пользователей (по винстрику):',
            entries,
            footer: 'Отсортировано по количеству побед подряд!',
        };
    }

    /**
     * Get leaderboard by losing streak
     */
    async getLeaderboardByLosingStreak(): Promise<LeaderboardData> {
        const query = `
      WITH user_losing_streaks AS (
        SELECT 
          u.id,
          u.name,
          gs.outcome,
          ROW_NUMBER() OVER (PARTITION BY u.id ORDER BY gs.created_at DESC) as rn,
          ROW_NUMBER() OVER (PARTITION BY u.id, gs.outcome ORDER BY gs.created_at DESC) as outcome_rn
        FROM "user" u
        LEFT JOIN "gameSessions" gs ON u.id = gs.user_id
        WHERE gs.outcome IS NOT NULL
      ),
      current_streaks AS (
        SELECT 
          id,
          name,
          outcome,
          ROW_NUMBER() OVER (PARTITION BY id ORDER BY rn) as streak_length
        FROM user_losing_streaks
        WHERE rn = outcome_rn AND outcome = 'lost'
      )
      SELECT 
        name as username,
        MAX(streak_length) as losing_streak
      FROM current_streaks
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

        return {
            title: 'Топ пользователей (по лузстрику):',
            entries,
            footer: 'Отсортировано по количеству поражений подряд!',
        };
    }

    /**
     * Get leaderboard by number of games
     */
    async getLeaderboardByGames(): Promise<LeaderboardData> {
        const query = `
      SELECT 
        u.name as username,
        COUNT(gs.id) as games_count
      FROM "user" u
      LEFT JOIN "gameSessions" gs ON u.id = gs.user_id
      GROUP BY u.id, u.name
      HAVING COUNT(gs.id) > 0
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
