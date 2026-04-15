import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate'
import { verifyOtpSchema, resendOtpSchema } from '../schemas/otp.schema'
import * as otpController from '../controllers/otp.controller'

const router = Router()

// All OTP routes require authentication — user must be logged in
router.post('/verify-email', authenticate, validate(verifyOtpSchema), otpController.verifyEmail)
router.post('/verify-phone', authenticate, validate(verifyOtpSchema), otpController.verifyPhone)
router.post('/resend', authenticate, validate(resendOtpSchema), otpController.resendOtp)

export default router
