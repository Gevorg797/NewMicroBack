import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class B2BSlotsUtilsService {
    // Placeholder: adjust to provider's signing rules from PDF
    sign(params: Record<string, any>, secret: string) {
        const payload = Object.keys(params)
            .sort()
            .map((k) => `${k}=${params[k]}`)
            .join('&');
        return crypto.createHash('md5').update(`${payload}${secret}`).digest('hex');
    }
}


