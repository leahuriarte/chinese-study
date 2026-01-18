import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../db.js';
import { seedVocabForUser } from './vocabSeedService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-production';

export interface RegisterData {
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export const authService = {
  async register(data: RegisterData) {
    const { email, password } = data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user with default settings
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        settings: {
          dailyNewCards: 20,
          dailyReviewLimit: 100,
          preferredQuizModes: ['hanzi_to_pinyin'],
          showPinyinTones: 'marks',
        },
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
        settings: true,
      },
    });

    // Seed Integrated Chinese vocabulary for the new user
    try {
      await seedVocabForUser(user.id);
    } catch (error) {
      console.error('Failed to seed vocabulary for new user:', error);
      // Don't fail registration if vocab seeding fails
    }

    // Generate tokens
    const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: '1d',
    });

    const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, {
      expiresIn: '7d',
    });

    return {
      user,
      accessToken,
      refreshToken,
    };
  },

  async login(data: LoginData) {
    const { email, password } = data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Generate tokens
    const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: '1d',
    });

    const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, {
      expiresIn: '7d',
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        settings: user.settings,
      },
      accessToken,
      refreshToken,
    };
  },

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        createdAt: true,
        settings: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  },

  async refreshToken(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string };

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          createdAt: true,
          settings: true,
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, {
        expiresIn: '1d',
      });

      return {
        user,
        accessToken,
      };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  },
};
