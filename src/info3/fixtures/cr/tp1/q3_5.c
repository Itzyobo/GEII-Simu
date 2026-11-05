#include "mcc_generated_files/mcc.h"
void main(void)
{
    uint8_t Chenille = 0x01;
    SYSTEM_Initialize();
    while (1)
    {
        PORTA = (PORTA & 0x0F) | (uint8_t)(Chenille << 4);
        __delay_ms(1000);
        Chenille <<= 1;
        if (Chenille > 0x08)
            Chenille = 0x01;
    }
}
