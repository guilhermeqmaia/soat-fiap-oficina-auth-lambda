# Imagem da function baseada no runtime oficial da AWS Lambda para Node.js 20.
# Serve para dois usos:
#   1. testar a Lambda localmente (o runtime traz o Runtime Interface Emulator,
#      que expoe http://localhost:9000/2015-03-31/functions/function/invocations);
#   2. deploy da Lambda como imagem de container (ECR), alternativa ao zip.
#
# Multi-stage: as devDependencies e o codigo TypeScript ficam no builder; a
# imagem final leva apenas o bundle gerado pelo esbuild.

FROM public.ecr.aws/lambda/nodejs:20 AS builder
WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
RUN npm run build

FROM public.ecr.aws/lambda/nodejs:20 AS runtime

# ${LAMBDA_TASK_ROOT} = /var/task
COPY --from=builder /build/dist/index.js ${LAMBDA_TASK_ROOT}/index.js

# Entrada unica: despacha POST /auth e o Lambda Authorizer pelo formato do evento.
CMD ["index.handler"]
