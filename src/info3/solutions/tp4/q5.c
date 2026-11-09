#include "mcc_generated_files/mcc.h"

void ENCB_ISR(void);
void led_ring_display16(uint16_t led_state);

volatile uint8_t cpt = 0;   // position du codeur modulo 16

void main(void)
{
    uint8_t last = 0xFF;

    SYSTEM_Initialize();

    IOCAF2_SetInterruptHandler(ENCB_ISR);
    RST_SetHigh();
    SPI1_Open(SPI1_DEFAULT);

    INTERRUPT_GlobalInterruptEnable();

    while (1)
    {
        if (cpt != last)
        {
            last = cpt;
            led_ring_display16((uint16_t)1 << last);
            PORTA = (PORTA & 0x0F) | (last << 4);
        }
    }
}

/* Un front de ENCB par cran : ENCA = ENCB en sens horaire (TP2) */
void ENCB_ISR(void)
{
    if (ENCB_GetValue() == ENCA_GetValue())
    {
        cpt = (cpt + 1) & 0x0F;
    }
    else
    {
        cpt = (cpt - 1) & 0x0F;
    }
}

void led_ring_display16(uint16_t led_state)
{
    SPI1_ExchangeByte(led_state >> 8);
    SPI1_ExchangeByte(led_state & 0xFF);
    LATCH_SetHigh();
    LATCH_SetLow();
}
