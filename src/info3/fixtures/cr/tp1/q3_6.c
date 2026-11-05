#include "mcc_generated_files/mcc.h"
uint8_t Chenille = 0b0110;
void Decale_Gauche(void);
void Decale_Droite(void);
void Decale_Gauche(void)
{
    Chenille = ((Chenille << 1) | (Chenille >> 3)) & 0x0F;
}
void Decale_Droite(void)
{
    Chenille = ((Chenille >> 1) | (Chenille << 3)) & 0x0F;
}
void main(void)
{
    SYSTEM_Initialize();
    while (1)
    {
        PORTA = (PORTA & 0x0F) | (uint8_t)(Chenille << 4);
        __delay_ms(500);
        if (BP_S1_GetValue() == 0)
            Decale_Droite();
        else
            Decale_Gauche();
    }
}
