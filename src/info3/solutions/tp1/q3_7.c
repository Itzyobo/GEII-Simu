#include "mcc_generated_files/mcc.h"
void Rotate_Right_4Bits(uint8_t *PtrMotif);
void Rotate_Left_4Bits(uint8_t *PtrMotif);
void Rotate_Right_4Bits(uint8_t *PtrMotif)
{
    *PtrMotif = ((*PtrMotif >> 1) | (*PtrMotif << 3)) & 0x0F;
}
void Rotate_Left_4Bits(uint8_t *PtrMotif)
{
    *PtrMotif = ((*PtrMotif << 1) | (*PtrMotif >> 3)) & 0x0F;
}
void main(void)
{
    uint8_t Motif = 0x01;
    SYSTEM_Initialize();
    while (1)
    {
        PORTA = (PORTA & 0x0F) | (Motif << 4);
        __delay_ms(1000);
        if (BP_S1_GetValue() == 1)
            Rotate_Left_4Bits(&Motif);
        else
            Rotate_Right_4Bits(&Motif);
    }
}
