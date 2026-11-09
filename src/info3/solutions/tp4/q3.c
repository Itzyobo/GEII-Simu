#include "mcc_generated_files/mcc.h"

void led_ring_clear(void);
void led_ring_display16(uint16_t led_state);

void main(void)
{
    SYSTEM_Initialize();

    RST_SetHigh();
    SPI1_Open(SPI1_DEFAULT);

    led_ring_clear();
    led_ring_display16(0xA5A5);

    while (1)
    {
    }
}

/* bit 0 de led_state = LED 1 ... bit 15 = LED 16 */
void led_ring_display16(uint16_t led_state)
{
    SPI1_ExchangeByte(led_state >> 8);      // part en premier, finit dans U3 (LED 9 a 16)
    SPI1_ExchangeByte(led_state & 0xFF);    // U2 (LED 1 a 8)
    LATCH_SetHigh();
    LATCH_SetLow();
}

void led_ring_clear(void)
{
    led_ring_display16(0x0000);
}
