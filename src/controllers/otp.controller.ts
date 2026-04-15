import { Request, Response, NextFunction } from 'express'
import { OtpType, OtpChannel } from '@prisma/client'
import * as authService from '../services/auth.service'

export const verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.verifyEmailOtp(req.user!.id, req.body.code)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export const verifyPhone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.verifyPhoneOtp(req.user!.id, req.body.code)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export const resendOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.resendOtp(
      req.user!.id,
      req.body.type as OtpType,
      req.body.channel as OtpChannel,
    )
    res.json(result)
  } catch (err) {
    next(err)
  }
}
