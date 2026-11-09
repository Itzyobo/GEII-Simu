#include "mcc_generated_files/mcc.h"

/*
 * TP4 question 1 : envoi de l'octet 0b00110001 (0x31) toutes les 100 ms.
 * MCC : MSSP1 en SPI Master, SPI Mode 3, Clock Source FOSC/4 (SCK = 1 MHz avec Fosc = 4 MHz).
 * A l'oscilloscope : TP17 = SCK, TP16 = MOSI.
 */
void main(void)
{
    SYSTEM_Initialize();

    SPI1_Open(SPI1_DEFAULT);

    while (1)
    {
        SPI1_WriteByte(0x31);
        __delay_ms(100);
    }
}
