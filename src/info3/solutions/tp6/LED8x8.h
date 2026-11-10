#ifndef LED8X8_H
#define LED8X8_H

#include <stdint.h>

/* Registres du MAX7219 (annexe 6, table 2) */
#define LED8x8_DECODE_MODE   0x09
#define LED8x8_INTENSITY     0x0A
#define LED8x8_SCAN_LIMIT    0x0B
#define LED8x8_SHUTDOWN      0x0C
#define LED8x8_DISPLAY_TEST  0x0F

void LED8x8_Write (uint8_t reg, uint8_t val);
void LED8x8_Initialize(uint8_t intensity) ;
void LED8x8_Clear( );
void blank_100ms(uint8_t delay_100ms);

#endif
