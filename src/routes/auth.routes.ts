import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate'
import {
  registerSchema,
  loginSchema,
  phoneOtpRequestSchema,
  phoneOtpVerifySchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  enable2FASchema,
  verify2FASchema,
} from '../schemas/auth.schema'
import { verifyOtpSchema, resendOtpSchema } from '../schemas/otp.schema'
import * as authController from '../controllers/auth.controller'

const router = Router()

// ─── Public ───────────────────────────────────────────────────────────────────

router.post('/register', validate(registerSchema), authController.register)
router.post('/login', validate(loginSchema), authController.login)

router.post('/phone-login', validate(phoneOtpRequestSchema), authController.phoneLogin)
router.post('/phone-login/verify', validate(phoneOtpVerifySchema), authController.phoneLoginVerify)

router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword)
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword)

router.post('/2fa/verify', validate(verify2FASchema), authController.verify2FA)

// ─── Protected ────────────────────────────────────────────────────────────────

router.get('/me', authenticate, authController.me)

router.post('/verify-email', authenticate, validate(verifyOtpSchema), authController.verifyEmail)
router.post('/verify-phone', authenticate, validate(verifyOtpSchema), authController.verifyPhone)
router.post('/resend-otp', authenticate, validate(resendOtpSchema), authController.resendOtp)

router.post('/2fa/enable', authenticate, validate(enable2FASchema), authController.enable2FA)
router.post('/2fa/disable', authenticate, authController.disable2FA)

export default router
