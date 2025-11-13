import { Router, Request, Response } from 'express';
import { jwtService } from '@/utils/jwt';
import { AuthService } from '@/middleware/auth';
import crypto from 'crypto';

const router = Router();

/**
 * Debug endpoint to check JWT configuration
 * REMOVE THIS IN PRODUCTION!
 */
router.get('/jwt-check', async (req: Request, res: Response) => {
  try {
    const jwtSecretHash = crypto.createHash('md5').update(process.env.JWT_SECRET || '').digest('hex');
    
    // Test token generation
    const testPayload = {
      userId: 'test123',
      email: 'test@example.com',
      role: 'user' as any
    };
    
    // Generate token with jwtService
    const token1 = jwtService.generateAccessToken(testPayload.userId, testPayload.email, testPayload.role);
    
    // Generate token with AuthService
    const token2 = AuthService.generateAccessToken(testPayload);
    
    // Try to verify both
    let verify1, verify2;
    try {
      verify1 = jwtService.verifyAccessToken(token1);
    } catch (e: any) {
      verify1 = { error: e.message };
    }
    
    try {
      verify2 = AuthService.verifyAccessToken(token2);
    } catch (e: any) {
      verify2 = { error: e.message };
    }
    
    res.json({
      success: true,
      data: {
        env: {
          JWT_SECRET_DEFINED: !!process.env.JWT_SECRET,
          JWT_SECRET_HASH: jwtSecretHash.substring(0, 8) + '...',
          JWT_REFRESH_SECRET_DEFINED: !!process.env.JWT_REFRESH_SECRET,
          NODE_ENV: process.env.NODE_ENV,
        },
        tokens: {
          jwtService_generated: token1.substring(0, 50) + '...',
          authService_generated: token2.substring(0, 50) + '...',
          same: token1 === token2
        },
        verification: {
          jwtService_verify: verify1,
          authService_verify: verify2
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Test token with your actual token
 */
router.post('/verify-my-token', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token required in request body'
      });
    }
    
    let jwtResult, authResult;
    
    // Try jwtService
    try {
      jwtResult = jwtService.verifyAccessToken(token);
    } catch (e: any) {
      jwtResult = { error: e.name, message: e.message };
    }
    
    // Try AuthService
    try {
      authResult = AuthService.verifyAccessToken(token);
    } catch (e: any) {
      authResult = { error: e.name, message: e.message };
    }
    
    res.json({
      success: true,
      data: {
        jwtService: jwtResult,
        authService: authResult,
        tokenPreview: token.substring(0, 50) + '...'
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
