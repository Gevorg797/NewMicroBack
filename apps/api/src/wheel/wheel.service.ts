import { Injectable } from '@nestjs/common';
import { RecoilType } from './dto/wheel-spin.dto';

@Injectable()
export class WheelService {
    private readonly amounts: number[] = [1000, 500, 200, 150, 100, 75, 50, 35, 25, 10];

    private readonly distributions: Record<RecoilType, number[]> = {
        [RecoilType.BAD]: [3, 5, 5, 7, 7, 10, 10, 15, 18, 20],
        [RecoilType.NORMAL]: [3, 3, 5, 18, 26, 18, 10, 7, 5, 5],
        [RecoilType.GOOD]: [12, 13, 20, 24, 14, 5, 3, 3, 3, 3],
        [RecoilType.SUPER]: [17, 24, 20, 12, 10, 5, 3, 3, 3, 3],
    };

    spin(recoil: RecoilType): { amount: number; index: number; distribution: number[] } {
        const weights = this.distributions[recoil];
        const total = weights.reduce((sum, w) => sum + w, 0);
        const r = Math.random() * total;
        let acc = 0;
        let idx = 0;
        for (let i = 0; i < weights.length; i++) {
            acc += weights[i];
            if (r < acc) {
                idx = i;
                break;
            }
        }
        return { amount: this.amounts[idx], index: idx, distribution: weights };
    }
}


