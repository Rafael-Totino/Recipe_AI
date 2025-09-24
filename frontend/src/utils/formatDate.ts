export const formatTime = (isoDate: string) => {
  try {
    const date = new Date(isoDate);
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch (error) {
    console.error('Unable to format date', error);
    return '';
  }
};
