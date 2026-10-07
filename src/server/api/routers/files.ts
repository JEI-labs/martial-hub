import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { uploadFileSchema } from '@/server/validations/files';
import { TRPCError } from '@trpc/server';
import { put } from '@vercel/blob';

const MAX_FILE_UPLOAD_SIZE = 4.5 * 1024 * 1024; // 4.5 MB

export const filesRouter = createTRPCRouter({
  upload: protectedProcedure
    .input(uploadFileSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Não autorizado',
        });
      }

      const { filename, file } = input;
      let buffer: Buffer;

      try {
        buffer = Buffer.from(file, 'base64');
      } catch (e) {
        console.error(e);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Arquivo base64 inválido',
        });
      }

      if (buffer.length > MAX_FILE_UPLOAD_SIZE) {
        throw new TRPCError({
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Arquivo deve ter no máximo 4.5MB',
        });
      }

      // `put` accepts a Buffer directly, so no Blob round-trip is needed.
      const blob = await put(filename, buffer, {
        access: 'public',
      });

      return blob;
    }),
});
