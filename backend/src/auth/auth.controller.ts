import { Controller } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'

import { contract } from '@/shared/contracts'

@Controller()
export class AuthController {
  @Implement(contract.auth.status)
  status() {
    return implement(contract.auth.status).handler(() => {
      return false
    })
  }

  @Implement(contract.auth.userinfo)
  userinfo() {
    return implement(contract.auth.userinfo).handler(() => {
      return { id: '019fe5dc-cb30-765f-9ee0-3331abbf3386', name: 'test', email: 'test@test.com' }
    })
  }
}
