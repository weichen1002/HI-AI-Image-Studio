import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import { config } from '../config';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

export interface Image {
  id: string;
  userId: string;
  mode?: 'text' | 'image';
  prompt: string;
  aspectRatio: string;
  content: string;
  imageUrls: string[];
  inputImageUrls?: string[];
  createdAt: string;
}

export interface Database {
  users: User[];
  images: Image[];
}

@Injectable()
export class DbService implements OnModuleInit {
  onModuleInit() {
    this.ensureDb();
  }

  ensureDb() {
    fs.mkdirSync(config.DATA_DIR, { recursive: true });
    if (!fs.existsSync(config.DB_FILE)) {
      this.writeDb({ users: [], images: [] });
    }
  }

  readDb(): Database {
    return JSON.parse(fs.readFileSync(config.DB_FILE, 'utf8'));
  }

  writeDb(db: Database) {
    fs.writeFileSync(config.DB_FILE, JSON.stringify(db, null, 2));
  }
}
