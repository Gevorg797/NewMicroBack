import { Entity, Property, OneToOne } from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { FinanceProviderMethods } from './finance-provider-methods.entity';

@Entity({ tableName: 'payment_methods_image' })
export class PaymentMethodImage extends BaseEntity {
  @Property({ nullable: false })
  url!: string; // URL to the logo

  @Property({ nullable: false })
  key!: string; // Storage key (e.g., AWS S3 key)

  @Property({ nullable: false })
  contentType!: string; // MIME type of the logo (e.g., "image/png")

  @Property({ nullable: false })
  contentLength!: number; // Size of the file in bytes

  @OneToOne(() => FinanceProviderMethods, (method) => method.image, {
    nullable: true,
  })
  method: FinanceProviderMethods;
}
