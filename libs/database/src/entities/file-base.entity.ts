import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import { BaseEntity } from './base.entity';

@Entity({ abstract: true })
export abstract class FileBaseEntity extends BaseEntity {
  @Property()
  key!: string; // storage key/path (e.g., S3 key)

  @Property({ nullable: true })
  name?: string; // original filename

  @Property()
  mimeType!: string;

  @Property()
  size!: number; // bytes

  @Property({ nullable: true })
  url?: string; // optional public/signed URL snapshot

  @Property({ nullable: true, type: 'json' })
  metadata?: Record<string, any>;
}


