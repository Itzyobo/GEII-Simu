#include "mcc_generated_files/mcc.h"
#include "LED8x8.h"

/*
 * TP6 question 3 : sequence sur la matrice 8x8 (colonne 1 = registre Digit 0 = colonne de droite).
 */
void main(void)
{
    uint8_t Tab[8]={0x30,0x78,0x7C,0x3E,0x3E,0x7C,0x78,0x30};
    uint8_t Coeur[8]={0x00,0x18,0x3C,0x7E,0xFF,0xFF,0x66,0x00};
    uint8_t i, k;

    SYSTEM_Initialize();
    SPI1_Open(SPI1_DEFAULT);

    LED8x8_Initialize(0);   // intensite minimale
    LED8x8_Clear();

    while (1)
    {
        // Colonnes 1 a 8, 200 ms chacune
        for (i = 1; i <= 8; i++)
        {
            LED8x8_Write(i, 0xFF);
            __delay_ms(200);
            LED8x8_Write(i, 0x00);
        }

        // Lignes 1 a 8, 200 ms chacune
        for (i = 0; i < 8; i++)
        {
            for (k = 1; k <= 8; k++)
            {
                LED8x8_Write(k, 0x80 >> i);
            }
            __delay_ms(200);
        }
        LED8x8_Clear();

        // Diagonale : 5 clignotements de 500 ms
        for (k = 0; k < 5; k++)
        {
            for (i = 1; i <= 8; i++)
            {
                LED8x8_Write(i, 1 << (i - 1));
            }
            __delay_ms(500);
            blank_100ms(5);
        }

        // Motif Tab : 3 clignotements de 500 ms
        for (k = 0; k < 3; k++)
        {
            for (i = 0; i < 8; i++)
            {
                LED8x8_Write(i + 1, Tab[i]);
            }
            __delay_ms(500);
            blank_100ms(5);
        }

        // Motif personnel (coeur) : 3 clignotements de 500 ms
        for (k = 0; k < 3; k++)
        {
            for (i = 0; i < 8; i++)
            {
                LED8x8_Write(i + 1, Coeur[i]);
            }
            __delay_ms(500);
            blank_100ms(5);
        }
    }
}
