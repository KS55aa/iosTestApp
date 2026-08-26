#pragma once
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

char *locationEngineExecute(const char *request, const uint8_t *pairing, size_t pairingLength);
void locationEngineFree(char *result);

#ifdef __cplusplus
}
#endif
