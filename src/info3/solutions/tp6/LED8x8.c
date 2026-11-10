#include "mcc_generated_files/mcc.h"
#include "LED8x8.h"

/*
 * Bibliotheque de la carte 8x8 R click (MAX7219 sur le mikroBUS 1).
 * Trame de 16 bits, MSB en premier : adresse (D11-D8) puis donnee (D7-D0),
 * verrouillee au front montant de LOAD (RA3).
 */
void LED8x8_Write (uint8_t reg, uint8_t val)
{
    LOAD_SetLow();
    SPI1_ExchangeByte(reg);    // adresse
    SPI1_ExchangeByte(val);    // donnee
    LOAD_SetHigh();            // front montant : la trame est verrouillee
}

void LED8x8_Initialize(uint8_t intensity)
{
    LED8x8_Write(LED8x8_DISPLAY_TEST, 0x00);   // pas de test
    LED8x8_Write(LED8x8_DECODE_MODE, 0x00);    // pas de decodage : un bit = une LED
    LED8x8_Write(LED8x8_SCAN_LIMIT, 0x07);     // les 8 colonnes
    LED8x8_Write(LED8x8_INTENSITY, intensity & 0x0F);
    LED8x8_Write(LED8x8_SHUTDOWN, 0x01);       // fonctionnement normal
}

void LED8x8_Clear( )
{
    uint8_t col;
    for (col = 1; col <= 8; col++)
    {
        LED8x8_Write(col, 0x00);
    }
}

void blank_100ms(uint8_t delay_100ms)
{
    uint8_t i;
    LED8x8_Clear();
    for (i = 0; i < delay_100ms; i++)
    {
        __delay_ms(100);
    }
}
