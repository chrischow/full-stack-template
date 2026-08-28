import { Test, TestingModule } from '@nestjs/testing'

import { PasskeyService } from './passkey.service'

describe('PasskeyService', () => {
  let service: PasskeyService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PasskeyService],
    }).compile()

    service = module.get<PasskeyService>(PasskeyService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
