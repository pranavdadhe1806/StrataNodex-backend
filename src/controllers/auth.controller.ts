import { Request, Response, NextFunction } from 'express'
import { TwoFactorMethod } from '@prisma/client'
import * as authService from '../services/auth.service'

// ─── Register / Login / Me ────────────────────────────────────────────────────

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.registerWithPassword(req.body)
    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
}

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.loginWithPassword(req.body)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export const me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await authService.getMe(req.user!.id)
    res.json(user)
  } catch (err) {
    next(err)
  }
}

// ─── Phone OTP Login ──────────────────────────────────────────────────────────

export const phoneLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.requestPhoneOtp(req.body.phone)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export const phoneLoginVerify = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.verifyPhoneLogin(req.body)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

// ─── Password Reset ───────────────────────────────────────────────────────────

export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.requestPasswordReset(req.body.email)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.resetPassword(req.body)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

// ─── 2FA ──────────────────────────────────────────────────────────────────────

export const enable2FA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.enable2FA(req.user!.id, req.body.method as TwoFactorMethod)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export const disable2FA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.disable2FA(req.user!.id)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export const verify2FA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.verify2FA(req.body)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

// ─── OTP verification (email / phone confirm) ─────────────────────────────────

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
    const result = await authService.resendOtp(req.user!.id, req.body.type, req.body.channel)
    res.json(result)
  } catch (err) {
    next(err)
  }
}
