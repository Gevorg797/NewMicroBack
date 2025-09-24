import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class SuperomaticUtilsService {
  generateSigniture(
    params: Record<string, any>,
    secretKey: string,
    endpoint: string,
  ) {
    const filteredParams = Object.keys(params)
      .filter(
        (name) =>
          !(name.startsWith('partner.') || name === 'meta' || name === 'sign'),
      )
      .sort()
      .map((name) => `${name}=${params[name]}`)
      .join('&');

    const serviceName = this.splitString(endpoint);
    const chunkToSign = params['partner.alias']
      ? `&${serviceName}&${params['partner.alias']}&${secretKey}`
      : `&${serviceName}&${secretKey}`;
    const stringToSign = `${filteredParams}${chunkToSign}`;

    const sign = crypto.createHash('md5').update(stringToSign).digest('hex');
    return sign;
  }

  splitString(endpoint: string) {
    const [first, second] = endpoint.split('/');
    return second;
  }

  modificationForGameLoad(data: any) {
    const modificatedData = {
      uuid: data.id,
      name: data.title,
      subProvider: data.group,
      type: data.type,
    };

    return modificatedData;
  }
}
