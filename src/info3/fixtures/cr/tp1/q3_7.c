#include "mcc_generated_files/mcc.h"
void Decale_Droite(uint8_t *PtrMotif);
void Decale_Gauche(uint8_t *PtrMotif);
void Decale_Droite(uint8_t *PtrMotif)
{
    *PtrMotif = ((*PtrMotif << 1) | (*PtrMotif >> 3)) & 0x0F;
}
void Decale_Gauche(uint8_t *PtrMotif)
{
    *PtrMotif = ((*PtrMotif >> 1) | (*PtrMotif << 3)) & 0x0F;
}
void main(void)
{
    uint8_t Chenille = 0x01;
    SYSTEM_Initialize();
    while (1)
    {
        PORTA = (PORTA & 0x0F) | (Chenille << 4);
        __delay_ms(1000);
        if (BP_S1_GetValue() == 1)
            Decale_Droite(&Chenille);
        else
            Decale_Gauche(&Chenille);
    }
}
