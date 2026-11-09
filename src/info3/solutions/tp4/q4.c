#include "mcc_generated_files/mcc.h"

void led_ring_clear(void);
void led_ring_display16(uint16_t led_state);

void main(void)
{
    uint16_t led = 0x0001;

    SYSTEM_Initialize();

    RST_SetHigh();
    SPI1_Open(SPI1_DEFAULT);

    while (1)
    {
        led_ring_display16(led);
        __delay_ms(1000);
        if (led == 0x8000)
        {
            led = 0x0001;           // apres la LED 16, retour a la LED 1
        }
        else
        {
            led = led << 1;
        }
    }
}

void led_ring_display16(uint16_t led_state)
{
    SPI1_ExchangeByte(led_state >> 8);
    SPI1_ExchangeByte(led_state & 0xFF);
    LATCH_SetHigh();
    LATCH_SetLow();
}

void led_ring_clear(void)
{
    led_ring_display16(0x0000);
}
