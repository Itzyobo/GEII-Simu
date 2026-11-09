#include "mcc_generated_files/mcc.h"

void led_ring_display16(uint16_t led_state);

/*
 * TP4 question 6 : animation 1 = motif 0xF0F0 qui tourne d'une LED par pas ;
 * un appui sur S1 passe a l'animation 2 (remplissage puis vidage de l'anneau).
 */
void main(void)
{
    uint16_t motif = 0xF0F0;
    uint16_t remplissage = 0x0000;
    uint8_t animation = 1;

    SYSTEM_Initialize();

    RST_SetHigh();
    SPI1_Open(SPI1_DEFAULT);

    while (1)
    {
        if (BP_S1_GetValue() == 0)
        {
            animation = 2;
        }

        if (animation == 1)
        {
            led_ring_display16(motif);
            motif = (motif << 1) | (motif >> 15);   // rotation d'un bit
        }
        else
        {
            led_ring_display16(remplissage);
            if (remplissage == 0xFFFF)
            {
                remplissage = 0x0000;
            }
            else
            {
                remplissage = (remplissage << 1) | 1;
            }
        }
        __delay_ms(100);
    }
}

void led_ring_display16(uint16_t led_state)
{
    SPI1_ExchangeByte(led_state >> 8);
    SPI1_ExchangeByte(led_state & 0xFF);
    LATCH_SetHigh();
    LATCH_SetLow();
}
