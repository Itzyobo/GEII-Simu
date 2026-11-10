#include "mcc_generated_files/mcc.h"

typedef struct {
     uint8_t red;
     uint8_t green;
     uint8_t blue;
} rgb_color_t;

typedef enum
{
  SET_RED,
  SET_GREEN,
  SET_BLUE
} state_t;

void RGBL_SetColor(rgb_color_t color);
void IncrementCurrentColor(void);
void AfficheEtat(void);
void BP_S1_ISR(void);
void BP_S2_ISR(void);

volatile rgb_color_t couleur = {0, 0, 0};
volatile state_t etat = SET_RED;

/*
 * TP5 question 3 : machine a etats. S2 (IOC) passe au champ suivant (rouge -> vert -> bleu -> rouge),
 * visualise sur LED_D5 (rouge), LED_D4 (vert), LED_D3 (bleu) ; S1 (IOC) ajoute 16 au champ courant.
 * Au-dela de 255 le champ uint8_t deborde et repart de 0.
 */
void main(void)
{
    SYSTEM_Initialize();

    IOCBF4_SetInterruptHandler(BP_S1_ISR);
    IOCCF5_SetInterruptHandler(BP_S2_ISR);

    RGBL_SetColor(couleur);
    AfficheEtat();

    INTERRUPT_GlobalInterruptEnable();

    while (1)
    {
    }
}

void RGBL_SetColor(rgb_color_t color)
{
    PWM6_LoadDutyValue((uint16_t)color.red << 2);
    PWM7_LoadDutyValue((uint16_t)color.green << 2);
    PWM1_LoadDutyValue((uint16_t)color.blue << 2);
}

void IncrementCurrentColor(void)
{
    switch (etat)
    {
        case SET_RED:
            couleur.red = couleur.red + 16;
            break;
        case SET_GREEN:
            couleur.green = couleur.green + 16;
            break;
        case SET_BLUE:
            couleur.blue = couleur.blue + 16;
            break;
    }
    RGBL_SetColor(couleur);
}

void AfficheEtat(void)
{
    LED_D5_SetLow();
    LED_D4_SetLow();
    LED_D3_SetLow();
    if (etat == SET_RED)
    {
        LED_D5_SetHigh();
    }
    else if (etat == SET_GREEN)
    {
        LED_D4_SetHigh();
    }
    else
    {
        LED_D3_SetHigh();
    }
}

void BP_S1_ISR(void)
{
    IncrementCurrentColor();
}

void BP_S2_ISR(void)
{
    if (etat == SET_RED)
    {
        etat = SET_GREEN;
    }
    else if (etat == SET_GREEN)
    {
        etat = SET_BLUE;
    }
    else
    {
        etat = SET_RED;
    }
    AfficheEtat();
}
