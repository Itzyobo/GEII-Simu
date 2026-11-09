#include "mcc_generated_files/mcc.h"

/*
 * TP4 question 2 : motif 00110001 sur les LED 1 a 8 de l'anneau (LED 1, 5 et 6).
 * Rotary sur le mikroBUS 2 : RST = RD2 (MR des 74HC595, actif a 0), LATCH = RD3.
 * Mode SPI 0 ou 3 : le 74HC595 lit la donnee au front montant de SCK.
 */
void main(void)
{
    SYSTEM_Initialize();

    RST_SetHigh();              // MR inactif
    SPI1_Open(SPI1_DEFAULT);

    while (1)
    {
        SPI1_ExchangeByte(0x31);
        LATCH_SetHigh();        // front montant : registre -> sorties
        LATCH_SetLow();
        __delay_ms(100);
    }
}
