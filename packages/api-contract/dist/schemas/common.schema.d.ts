import z from 'zod'
export declare const UuidSchema: z.ZodObject<
  {
    id: z.ZodUUID
  },
  z.z.core.$strip
>
export type Uuid = z.infer<typeof UuidSchema>
//# sourceMappingURL=common.schema.d.ts.map
