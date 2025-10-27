import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager } from '@mikro-orm/core';
import {
    Promocode,
    PromocodeUsage,
    User,
    Balances,
    PromocodeType,
    PromocodeStatus,
    PromocodeUsageStatus,
    BalanceType,
} from '@lib/database';
import { CreatePromocodeDto } from './dto/create-promocode.dto';


@Injectable()
export class PromocodesService {
    constructor(
        @InjectRepository(Promocode)
        private readonly promocodeRepository: EntityRepository<Promocode>,
        @InjectRepository(PromocodeUsage)
        private readonly promocodeUsageRepository: EntityRepository<PromocodeUsage>,
        @InjectRepository(User)
        private readonly userRepository: EntityRepository<User>,
        @InjectRepository(Balances)
        private readonly balancesRepository: EntityRepository<Balances>,
        private readonly em: EntityManager,
    ) { }

    /**
     * Create a new promocode
     */
    async create(createPromocodeDto: CreatePromocodeDto): Promise<Promocode> {
        // Check if code already exists
        const existing = await this.promocodeRepository.findOne({
            code: createPromocodeDto.code,
        });

        if (existing) {
            throw new BadRequestException(
                `Promocode with code "${createPromocodeDto.code}" already exists`,
            );
        }

        // Verify the admin user exists
        const admin = await this.userRepository.findOne({
            id: createPromocodeDto.createdById,
        });

        if (!admin) {
            throw new NotFoundException('Admin user not found');
        }

        const promocode = this.promocodeRepository.create({
            ...createPromocodeDto,
            createdBy: admin,
            status: createPromocodeDto.status || PromocodeStatus.ACTIVE,
            maxUses: createPromocodeDto.maxUses || 1,
        });

        await this.em.persistAndFlush(promocode);

        return promocode;
    }

    /**
     * Apply a promocode for a user
     */
    async applyPromocode(
        userId: number,
        code: string,
    ): Promise<{ success: boolean; bonusAmount: number; message: string }> {
        return await this.em.transactional(async (em) => {
            // Find the user
            const user = await em.findOne(User, { id: userId });
            if (!user) {
                throw new NotFoundException('User not found');
            }

            // Find the promocode
            const promocode = await em.findOne(Promocode, {
                code: code,
            });

            if (!promocode) {
                throw new NotFoundException('Promocode not found');
            }

            // Validate promocode is active
            if (promocode.status !== PromocodeStatus.ACTIVE) {
                throw new BadRequestException('Promocode is not active');
            }

            // Check date validity
            const now = new Date();
            if (promocode.validFrom && new Date(promocode.validFrom) > now) {
                throw new BadRequestException('Promocode is not yet valid');
            }

            if (promocode.validUntil && new Date(promocode.validUntil) < now) {
                throw new BadRequestException('Promocode has expired');
            }

            // Check if user has already used this promocode
            const existingUsage = await em.findOne(PromocodeUsage, {
                user: userId,
                promocode: promocode.id,
            });

            if (existingUsage) {
                throw new BadRequestException('You have already used this promocode');
            }

            // Count current usages
            const usageCount = await em.count(PromocodeUsage, {
                promocode: promocode.id,
            });

            // Check usage limits
            if (promocode.maxUses > 0 && usageCount >= promocode.maxUses) {
                throw new BadRequestException('Promocode has reached maximum uses');
            }

            // Find user's bonus balance
            const balance = await em.findOne(Balances, {
                user: userId,
                type: BalanceType.BONUS,
            });

            if (!balance) {
                throw new NotFoundException('User balance not found');
            }

            // Calculate bonus amount
            let bonusAmount = 0;
            if (promocode.type === PromocodeType.PERCENTAGE) {
                // For percentage, use the amount as percentage (e.g., amount: 50 means 50%)
                bonusAmount = promocode.amount;
            } else if (promocode.type === PromocodeType.FIXED_AMOUNT) {
                bonusAmount = promocode.amount;
            }

            // Apply the bonus to balance
            balance.balance += bonusAmount;

            // Record the usage
            const usage = em.create(PromocodeUsage, {
                user,
                promocode,
                usedAt: new Date(),
                status: PromocodeUsageStatus.APPLIED,
                bonusAmount,
                targetBalance: balance,
            });

            em.persist(usage);

            return {
                success: true,
                bonusAmount,
                message: `Promocode applied! You received ${bonusAmount} bonus.`,
            };
        });
    }

    /**
     * Get promocode by code
     */
    async findByCode(code: string): Promise<Promocode> {
        const promocode = await this.promocodeRepository.findOne(
            { code },
            {
                populate: ['createdBy'],
            },
        );

        if (!promocode) {
            throw new NotFoundException(`Promocode with code "${code}" not found`);
        }

        return promocode;
    }

    /**
     * Get promocode usage history for a user
     */
    async getUserPromocodeHistory(userId: number): Promise<PromocodeUsage[]> {
        return await this.promocodeUsageRepository.find(
            { user: userId },
            {
                populate: ['promocode', 'targetBalance'],
                orderBy: { usedAt: 'DESC' },
            },
        );
    }
}
