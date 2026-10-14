import { ConfigService } from '@nestjs/config'
import { Test, TestingModule } from '@nestjs/testing'

import { OtpService } from './otp.service'

describe('OtpService', () => {
  let service: OtpService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OtpService, { provide: ConfigService, useValue: { get: jest.fn() } }],
    }).compile()

    service = module.get<OtpService>(OtpService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
